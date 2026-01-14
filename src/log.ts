import { K8sIdentity } from ".";
import { getContext, WorkerContext } from "./context";

/**
 * Types of log emitted by this worker
 */
export type Log = SystemLog | K8sLog;

/**
 * Centralized logger helper. Handles normalization of log levels and formats
 * the output to ensure visibility in Cloudflare's real-time Worker Logs /
 * `wrangler tail`.
 */
export function log(log: Log) {
  const structuredLog = {
    log,
  };

  let level: keyof Console;
  let message: string;
  switch (log.type) {
    case "k8s_api":
      level = "info";
      message = "K8s Action Performed";
      break;
    case "system":
      level = log.level;
      message = log.message;
      break;
  }

  const logger = console[level] || console.log;
  logger(`[${level.toUpperCase()}] ${message}`, structuredLog);
}

/**
 * Convenience wrapper for standard application logs.
 * @param level - The log severity.
 * @param message - Human-readable summary.
 * @param context - Optional key-value dictionary for additional metadata.
 * @param workerContext - Optional. The Worker context, used here to access
 * logging settings. Do not provide if global, async local storage context is
 * still available.
 */
export function logSystem(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
  workerContext?: WorkerContext,
) {
  let configLogLevel: LogLevel;
  try {
    const { LOG_LEVEL } = getContext();
    configLogLevel = LOG_LEVEL;
  } catch {
    if (!workerContext) {
      throw new Error(
        "Internal Worker Error: Calling logSystem() outside of run scope requires workerContext to be explicitly passed.",
      );
    }
    configLogLevel = workerContext.LOG_LEVEL;
  }

  if (shouldLog(level, configLogLevel)) {
    log({
      type: "system",
      level: level,
      message,
      context,
    });
  }
}

/**
 * Log input for HTTP interactions. We pass the raw `Response` so the logger can
 * decide whether to clone and parse it (expensive) or ignore it (cheap).
 */
export type K8sHttpProtocolLogInput = {
  upstreamLatencyMs: number;
  response: Response;
};

/**
 * Asynchronously logs a Kubernetes HTTP API interaction.
 *
 * This function optimizes performance by deferring the expensive operation of
 * cloning and reading the response body until after the logging flag check.
 *
 * 1. Checks `ENABLE_K8S_LOGGING`. If false, returns immediately.
 * 2. If true, clones the response and parses potential errors.
 * 3. Dispatches the log.
 *
 * @param request - The original incoming HTTP request.
 * @param responseStatus - The final HTTP status code returned to the client.
 * @param k8sIdentity - The K8s identity that was impersonated.
 * @param logInput - Contains the latency and the raw Response object (for error
 * parsing).
 * @param context - The Worker context containing env vars.
 */
export async function logK8sHttp(
  request: Request,
  responseStatus: number,
  k8sIdentity: K8sIdentity,
  logInput: K8sHttpProtocolLogInput,
  context: WorkerContext,
) {
  const { ENABLE_K8S_LOGGING } = context;
  if ((ENABLE_K8S_LOGGING as string) !== "true") {
    return;
  }

  // We only pay the cost of cloning/parsing if we are actually logging.
  const error = (await getHttpError(logInput.response.clone())) ?? undefined;
  log({
    protocolLog: {
      protocol: "http",
      upstreamLatencyMs: logInput.upstreamLatencyMs,
      error,
    },
    ...getBaseK8sLog(request, responseStatus, k8sIdentity),
  });
}

/**
 * Logs a Kubernetes WebSocket session.
 *
 * Unlike the HTTP logger ({@link logK8sHttp}), this function is synchronous
   since it is executed in a sync WebSocket callback on WS close. WebSocket
   telemetry (duration, bytes) is tracked in memory during the session, so no
   expensive I/O operations are required to assemble the log entry.
 *
 * @param request - The original incoming HTTP request (handshake).
 * @param responseStatus - The final status code (usually 101 Switching
 * Protocols).
 * @param k8sIdentity - The K8s identity that was impersonated.
 * @param protocolLog - The final WebSocket telemetry data (duration, bytes,
 * errors).
 * @param context - The Worker context containing env vars.
 */
export function logK8sWebSocket(
  request: Request,
  responseStatus: number,
  k8sIdentity: K8sIdentity,
  protocolLog: K8sWebSocketProtocolLog,
  context: WorkerContext,
) {
  const { ENABLE_K8S_LOGGING } = context;
  if ((ENABLE_K8S_LOGGING as string) !== "true") {
    return;
  }

  log({
    protocolLog,
    ...getBaseK8sLog(request, responseStatus, k8sIdentity),
  });
}

/**
 * Conveience wrapper for logging exceptions safely. This function handles the
 * TypeScript 'unknown' error type and normalizes it into a JSON-serializable
 * structure.
 * @param message - Contextual message (e.g. "Failed to connect to DB").
 * @param error - The raw error object caught in a try/catch block.
 * @param context - Optional, additional metadata relevant to the failure.
 * @param workerContext - Optional. The Worker context, used here to access
 * logging settings. Do not provide if global, async local storage context is
 * still available.
 */
export function logSystemError(
  message: string,
  error: unknown,
  context?: Record<string, unknown>,
  workerContext?: WorkerContext,
) {
  let configLogLevel: LogLevel;
  try {
    const { LOG_LEVEL } = getContext();
    configLogLevel = LOG_LEVEL;
  } catch {
    if (!workerContext) {
      throw new Error(
        "Internal Worker Error: Calling logSystem() outside of run scope requires workerContext to be explicitly passed.",
      );
    }
    configLogLevel = workerContext.LOG_LEVEL;
  }

  if (!shouldLog("error", configLogLevel)) {
    return;
  }

  if (error instanceof Error) {
    log({
      type: "system",
      level: "error",
      message,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause,
      },
      context,
    });
  } else {
    log({
      type: "system",
      level: "error",
      message,
      error: { name: "Unknown", message: "Unknown Error" },
      context,
    });
  }
}

/**
 * Defines the severity of the log entry.
 */
export type LogLevel = "error" | "warn" | "info" | "debug";

/**
 * Standard Syslog numerical levels (RFC 5424).
 *
 * 3: Error
 * 4: Warning
 * 6: Informational
 * 7: Debug
 */
const LOG_LEVEL_SCORES: Record<LogLevel, number> = {
  error: 3,
  warn: 4,
  info: 6,
  debug: 7,
};

/**
 * Converts a string LogLevel to its numerical equivalent.
 */
export function getLogLevelScore(level: LogLevel): number {
  return LOG_LEVEL_SCORES[level];
}

/**
 * Determines if a log should be written.
 * @param messageLevel - The severity of the specific message.
 * @param configThreshold - The maximum verbosity allowed by the system.
 */
export function shouldLog(
  messageLevel: LogLevel,
  configThreshold: LogLevel,
): boolean {
  const messageScore = getLogLevelScore(messageLevel);
  const thresholdScore = getLogLevelScore(configThreshold);

  // If the config allows for a higher number (more verbose), it should include
  // all lower numbers (higher severity).
  return thresholdScore >= messageScore;
}

/**
 * Represents a generic application log. Used for internal worker logic,
 * authentication events, or system errors.
 */
export type SystemLog = {
  /** Discriminator field to identify this as a System log. */
  type: "system";
  /** The severity level. */
  level: LogLevel;
  /** Human-readable summary of the event. */
  message: string;
  /** Serialized representation of a JavaScript Error object. */
  error?: {
    name: string;
    message: string;
    stack?: string;
    cause?: unknown;
  };
  /** Arbitrary key-value pairs for additional, arbitrary metadata. */
  context?: Record<string, unknown>;
};

/**
 * Core metadata shared across all Kubernetes API interactions, regardless of
 * whether they are HTTP or WebSocket based.
 */
export type BaseK8sLog = {
  /** Discriminator field to identify this as a K8s API traffic log. */
  type: "k8s_api";
  /** The HTTP Verb used. */
  method: string;
  /** The URL path accessed on the K8s API (e.g., `/api/v1/pods`). */
  path?: string;
  /** URL query parameters. */
  queryParams?: Record<string, string>;
  /** The HTTP status code returned by the upstream Kubernetes API server. */
  statusCode: number;
  /** The User-Agent string from the client request. */
  userAgent?: string;
  /** Metadata specific to when the client uses kubectl to make the request.  */
  kubectl: {
    /** The specific command being executed (if detectable), e.g., "kubectl
     * get", "kubectl exec". */
    command?: string;
    sessionId?: string;
  };
  /** The parsed Kubernetes resource being targeted. */
  k8sResource?: K8sResource;
  /** The K8s identity that was impersonated. */
  k8sIdentity: K8sIdentity;
};

/**
 * Protocol-specific details for standard HTTP/REST requests to K8s.
 */
export type K8sHttpProtocolLog = {
  /** Discriminator for HTTP traffic. */
  protocol: "http";
  /** The time in milliseconds taken by the upstream K8s API to respond. */
  upstreamLatencyMs: number;
  /** The structured error returned by K8s if the request failed (non-2xx). */
  error?: K8sStatusError;
};

/**
 * Protocol-specific details for long-lived WebSocket connections (e.g. `kubectl
 * exec`)
 */
export type K8sWebSocketProtocolLog = {
  /** Discriminator for WebSocket traffic. */
  protocol: "websocket";
  /** Total duration of the connection in milliseconds. */
  durationMs?: number;
  /** Total bytes received from the **Client** (Ingress). Direction: Client ->
   * Worker -> K8s.
   */
  bytesReceived?: number;
  /** Total bytes sent from the **Origin/K8s** (Egress). Direction: K8s -> Proxy
   * -> Client.
   */
  bytesSent?: number;
  /** A string describing why the connection closed. */
  disconnectReason?: string;
  /** Captured websocket error event. */
  websocketError?: string;
};

/**
 * The main union type for Kubernetes traffic logs. It combines the base
 * metadata with the specific protocol details (HTTP vs WS).
 */
export type K8sLog = BaseK8sLog & {
  protocolLog: K8sHttpProtocolLog | K8sWebSocketProtocolLog;
};

/**
 * Represents the standard `v1.Status` object returned by Kubernetes APIs
 * when an operation fails (4xx/5xx).
 * @see https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.27/#status-v1-meta
 */
export type K8sStatusError = {
  kind: "Status";
  status: "Failure";
};

/**
 * Helper to safely extract a structured Kubernetes error from a Response.
 * @warning **Consumes the Response Body**: This function calls
 * `response.json()`. If you need to read the body again later, pass a
 * `response.clone()` to this function.
 * @param response - The fetch Response object from the K8s API.
 * @returns The parsed `K8sStatusError` if present, or `null` if the response
 * was successful (2xx) or not a valid K8s error.
 */
export async function getHttpError(
  response: Response,
): Promise<K8sStatusError | null> {
  if (response.ok) {
    return null;
  }

  let errorBody: unknown;
  try {
    errorBody = await response.json();
  } catch {
    return null;
  }

  if (isK8sError(errorBody)) {
    return errorBody;
  }

  return null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function isK8sError(body: any): body is K8sStatusError {
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return (
    body &&
    typeof body === "object" &&
    body.kind === "Status" &&
    body.status === "Failure"
  );
}

/**
 * Factory function to construct the shared base metadata for any Kubernetes API
 * interaction. Extracts standard HTTP details (method, path, status) as well as
 * custom headers injected by the kubectl client or proxy (e.g., session IDs).
 * @param request - The incoming HTTP Request.
 * @param responseStatus - The HTTP status code returned to the client.
 * @param k8sIdentity - The K8s identity that was impersonated.
 * @returns A structured `BaseK8sLog` object ready to be extended with
 * protocol-specific data.
 */
export function getBaseK8sLog(
  request: Request,
  responseStatus: number,
  k8sIdentity: K8sIdentity,
): BaseK8sLog {
  const url = new URL(request.url);
  return {
    type: "k8s_api",
    method: request.method,
    path: url.pathname ?? undefined,
    // Convert URLSearchParams to a simple key-value object for logging
    queryParams: Object.fromEntries(url.searchParams),
    statusCode: responseStatus,
    userAgent: request.headers.get("user-agent") ?? undefined,
    // Capture custom headers that are sent when client uses kubectl
    kubectl: {
      command: request.headers.get("kubectl-command") ?? undefined,
      sessionId: request.headers.get("kubectl-session") ?? undefined,
    },
    // Attempt to extract high-level resource info (e.g. "pod nginx") from the
    // raw URL path
    k8sResource: parseK8sResource(request) ?? undefined,
    k8sIdentity,
  };
}

/**
 * Represents the components of a Kubernetes API URL. Used to categorize traffic
 * by resource type rather than raw URL paths.
 */
export type K8sResource = {
  /** The API Group. `undefined` for the Core API (legacy `/api/v1`). Present
   * for named groups (e.g., "apps", "batch" in `/apis/apps/v1`).
   */
  apiGroup?: string;
  /** The API version (e.g., "v1", "v1beta1"). */
  version: string;

  /** The plural resource type (e.g., "pods", "deployments", "services"). */
  resourceType?: string;
  /** The namespace, if the resource is scoped to one. Undefined for
   * cluster-wide resources (e.g. Nodes). */
  namespace?: string;
  /** The name of the specific resource instance. */
  resourceName?: string;
  /** The sub-operation or sub-resource being accessed. Examples: "log" (pod
logs), "exec" (shell access), "status" (updating status only).
  */
  subresource?: string;
};

/**
 * Parses a raw Kubernetes API URL to extract structured resource information.
 *  Handles the two primary K8s API patterns:
 * 1. **Core API**: `/api/{version}/...` (e.g. Pods, Services, Nodes)
 * 2. **Named Groups**: `/apis/{group}/{version}/...` (e.g. Deployments,
 *    CronJobs)
 * @see
 * https://kubernetes.io/docs/reference/using-api/api-concepts/#resource-uris
 * @param request - The incoming Request object.
 * @returns The parsed `K8sResource` or `null` if the URL does not match a known
 * resource pattern.
 */
export function parseK8sResource(request: Request): K8sResource | null {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter((p) => p);

  // All resource types are either scoped by the cluster
  // (/apis/GROUP/VERSION/*) or to a namespace
  // (/apis/GROUP/VERSION/namespaces/NAMESPACE/*).
  //
  // Core resources use /api instead of /apis and omit the GROUP path segment.

  // Core API: /api/{version}/...
  if (parts.at(0) === "api") {
    const version = parts.at(1);
    if (!version) return null;

    // Namespaced:
    // /api/{version}/namespaces/{namespace}/{resourceType}/{name}/{subresource}
    if (parts.at(2) === "namespaces") {
      const namespace = parts.at(3);
      const resourceType = parts.at(4);
      const resourceName = parts.at(5);
      const subresource = parts.at(6);

      if (!namespace) return null;
      return { version, resourceType, namespace, resourceName, subresource };
    }

    // Cluster-scoped: /api/{version}/{resourceType}/{name}/{subresource}
    const resourceType = parts.at(2);
    const resourceName = parts.at(3);
    const subresource = parts.at(4);

    if (!resourceType) return null;
    return { version, resourceType, resourceName, subresource };
  }

  // Named API group: /apis/{group}/{version}/...
  if (parts.at(0) === "apis") {
    const apiGroup = parts.at(1);
    const version = parts.at(2);
    if (!apiGroup || !version) return null;

    // Namespaced:
    // /apis/{group}/{version}/namespaces/{namespace}/{resourceType}/{name}/{subresource}
    if (parts.at(3) === "namespaces") {
      const namespace = parts.at(4);
      const resourceType = parts.at(5);
      const resourceName = parts.at(6);
      const subresource = parts.at(7);

      if (!namespace) return null;
      return {
        apiGroup,
        version,
        namespace,
        resourceType,
        resourceName,
        subresource,
      };
    }

    // Cluster-scoped: /apis/{group}/{version}/{resourceType}/{name}/{subresource}
    const resourceType = parts.at(3);
    const resourceName = parts.at(4);
    const subresource = parts.at(5);

    if (!resourceType) return null;
    return { apiGroup, version, resourceType, resourceName, subresource };
  }

  return null;
}
