import { Redirect } from "wouter";

/**
 * /map — "Find a station" in the menu.
 *
 * This page used to be a pure "interactive map coming soon" placeholder whose
 * only working element was a button onward to /locations (2026-09-13 menu
 * dead-end audit). There is no interactive map, so the menu item now lands
 * directly on the real station list. When a real map exists, build it here.
 *
 * Earlier removals stay removed: the fake "50+ stations" stats and the
 * handler-less search/filter controls (2026-07-09) must not return.
 */
export default function StationMap() {
  return <Redirect to="/locations" replace />;
}
