/**
 * Next 14's bundled CSS HMR callbacks can finish after React or another update
 * has already detached the old stylesheet. Make that cleanup idempotent.
 * Applied only to the CSS HMR runtime in development; application DOM is untouched.
 */
module.exports = function cssHmrCleanupLoader(source) {
  return source.replace(
    /\b([A-Za-z_$][\w$]*)\.parentNode\.removeChild\(\1\)/g,
    "$1.parentNode?.removeChild($1)",
  );
};
