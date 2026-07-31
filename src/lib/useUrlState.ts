"use client";

// URL state persistence for the map's view controls.
//
// View mode, voltage filter and language previously lived only in React state,
// so a refresh reset the map and a shared link always landed on the defaults —
// you could not send someone "the 90kV network in reliability mode".
//
// Implementation note: the initial state is deliberately NOT read during render.
// This page is prerendered, so reading window.location in a useState initializer
// would make the server and client render different markup and trip a hydration
// mismatch. Instead the URL is applied in a mount effect (one frame after
// hydration), and only after that does state start writing back to the URL.
//
// Writes use history.replaceState rather than pushState: toggling a filter is a
// view adjustment, not navigation, and should not stack up entries the back
// button has to walk through.

import { useEffect, useRef } from "react";
import type { GridFilter, ViewMode, Lang } from "@/types/grid";

export interface UrlState {
  lang: Lang;
  filter: GridFilter;
  view: ViewMode;
}

const VALID_FILTERS: GridFilter[] = ["ALL", "225", "90", "MV"];
const VALID_VIEWS: ViewMode[] = ["infrastructure", "reliability"];
const VALID_LANGS: Lang[] = ["EN", "FR"];

// Parse the query string, ignoring anything unrecognized. An unknown or
// malformed value falls back to the current default rather than throwing, so a
// hand-edited or truncated link still loads a working map.
function parseUrl(search: string): Partial<UrlState> {
  const params = new URLSearchParams(search);
  const out: Partial<UrlState> = {};

  const view = params.get("view");
  if (view && (VALID_VIEWS as string[]).includes(view)) out.view = view as ViewMode;

  const filter = params.get("filter")?.toUpperCase();
  if (filter && (VALID_FILTERS as string[]).includes(filter)) out.filter = filter as GridFilter;

  const lang = params.get("lang")?.toUpperCase();
  if (lang && (VALID_LANGS as string[]).includes(lang)) out.lang = lang as Lang;

  return out;
}

// Serialize state to a query string, omitting values that are already the
// default so a pristine map keeps a clean URL.
function buildSearch(state: UrlState, defaults: UrlState): string {
  const params = new URLSearchParams();
  if (state.view !== defaults.view) params.set("view", state.view);
  if (state.filter !== defaults.filter) params.set("filter", state.filter);
  if (state.lang !== defaults.lang) params.set("lang", state.lang);
  const s = params.toString();
  return s ? `?${s}` : "";
}

/**
 * Two-way sync between the view controls and the query string.
 *
 * @param state    current values
 * @param apply    called once on mount with whatever the URL specified
 * @param defaults the values `state` was initialized to, used to keep clean URLs
 */
export function useUrlState(
  state: UrlState,
  apply: (fromUrl: Partial<UrlState>) => void,
  defaults: UrlState,
) {
  const hydrated = useRef(false);
  // `apply` and `defaults` are read only inside effects; refs keep them out of
  // the dependency arrays so a caller passing inline values can't cause loops.
  const applyRef = useRef(apply);
  applyRef.current = apply;
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  // Mount: adopt whatever the URL asked for.
  useEffect(() => {
    const fromUrl = parseUrl(window.location.search);
    if (Object.keys(fromUrl).length > 0) applyRef.current(fromUrl);
    hydrated.current = true;
  }, []);

  // Thereafter: mirror state into the URL. Skipped until the mount effect has
  // run, so the initial defaults never overwrite the incoming link.
  useEffect(() => {
    if (!hydrated.current) return;
    const search = buildSearch(state, defaultsRef.current);
    const next = `${window.location.pathname}${search}${window.location.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) window.history.replaceState(null, "", next);
  }, [state.lang, state.filter, state.view]);
}
