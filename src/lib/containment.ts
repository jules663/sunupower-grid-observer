// G2 Strict Public Containment — pure helpers (founder authorization 2026-10-10).
//
// Centralizes the containment decision so every public delivery path (UI view,
// URL state, and the event API routes) enforces the same rule, and so the
// behavior is unit-testable without rendering. Fail-closed: the default is the
// contained response.

import type { ViewMode } from "@/types/grid";
import { RELIABILITY_CONTAINED } from "@/lib/config";

// Neutral, machine-readable body returned by the public event API while
// contained. States unavailability without implying any verified grid condition.
export const CONTAINMENT_BODY = {
  status: "withheld",
  code: "G2_RELIABILITY_CONTAINMENT",
  reason:
    "Reliability intelligence is temporarily unavailable pending evidence qualification.",
  authorization: "G2 Strict Public Containment, 2026-10-10",
} as const;

export const CONTAINMENT_HTTP_STATUS = 503;

export interface ContainmentGuardResult {
  status: number;
  body: typeof CONTAINMENT_BODY;
}

/**
 * API guard. Returns the withheld result when reliability is contained, or null
 * when the caller may serve the real event data.
 *
 * The `contained` parameter defaults to the live flag; it exists so tests can
 * exercise both branches and demonstrate that the pre-containment path (false)
 * would serve the unqualified events, which is the behavior being contained.
 */
export function containmentGuard(
  contained: boolean = RELIABILITY_CONTAINED,
): ContainmentGuardResult | null {
  return contained ? { status: CONTAINMENT_HTTP_STATUS, body: CONTAINMENT_BODY } : null;
}

/**
 * Resolve the view the public is allowed to see. While contained, every request
 * for the reliability view (including a hand-edited `?view=reliability` URL)
 * resolves to the infrastructure view, so the withheld surface cannot be reached
 * through an alternative client route.
 */
export function resolvePublicView(
  requested: ViewMode,
  contained: boolean = RELIABILITY_CONTAINED,
): ViewMode {
  if (contained) return "infrastructure";
  return requested;
}

/** True when any reliability-intelligence public output must be withheld. */
export function isReliabilityContained(
  contained: boolean = RELIABILITY_CONTAINED,
): boolean {
  return contained;
}
