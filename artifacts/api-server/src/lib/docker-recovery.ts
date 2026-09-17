import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const SAFE_CONTAINER_TARGET = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;

export const ALLOWLISTED_ACTIONS = [
  "RESTART_CONTAINER",
  "START_CONTAINER",
  "RETRY_HEALTH_CHECK",
] as const;

export type AllowlistedAction = (typeof ALLOWLISTED_ACTIONS)[number];

export function isAllowlistedAction(value: string): value is AllowlistedAction {
  return (ALLOWLISTED_ACTIONS as readonly string[]).includes(value);
}

export async function executeAllowlistedAction(
  actionType: string,
  target: string | null,
): Promise<{ status: "SUCCESS" | "FAILED" | "BLOCKED"; result: string }> {
  if (!isAllowlistedAction(actionType)) {
    return {
      status: "BLOCKED",
      result: `Action "${actionType}" is not in the AutoHeal allowlist.`,
    };
  }

  if (actionType === "RETRY_HEALTH_CHECK") {
    return {
      status: "SUCCESS",
      result: "A verification health check was requested.",
    };
  }

  if (!target || !SAFE_CONTAINER_TARGET.test(target)) {
    return {
      status: "BLOCKED",
      result: "Container action blocked because its target is missing or invalid.",
    };
  }

  const command = actionType === "RESTART_CONTAINER" ? "restart" : "start";
  try {
    const { stdout, stderr } = await execFileAsync(
      "docker",
      [command, "--time", "10", target],
      { timeout: 20_000, maxBuffer: 32 * 1024 },
    );
    const output = `${stdout ?? ""} ${stderr ?? ""}`.trim().replace(/\s+/g, " ");
    return {
      status: "SUCCESS",
      result: output
        ? `Docker ${command} completed for the allowlisted target. ${output.slice(0, 400)}`
        : `Docker ${command} completed for the allowlisted target.`,
    };
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "ENOENT") {
      return {
        status: "BLOCKED",
        result: "Docker integration is not connected: the Docker CLI is unavailable.",
      };
    }
    const message =
      typeof error === "object" && error && "stderr" in error
        ? String(error.stderr)
        : error instanceof Error
          ? error.message
          : "Docker action failed.";
    return {
      status: "FAILED",
      result: `Docker ${command} did not complete: ${message.slice(0, 400).replace(/\s+/g, " ")}`,
    };
  }
}