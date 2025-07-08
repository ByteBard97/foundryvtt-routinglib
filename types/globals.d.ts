/* Custom ambient globals for RoutingLib
 * Keep this list minimal – add ONLY symbols that are truly unknown to the
 * official LoFD Foundry typings.  Everything else stays type-checked.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
  const terrainRuler: any;
  const game: any;
  const canvas: any;
  interface Window {
    routinglib: any;
    terrainRuler?: any;
  }

  /**
   * The Ray class in Foundry VTT v13 gained the optional `rulerState` property
   * (was `terrainRulerFinalState` in v12).  Until the LoFD typings include it
   * we declare it here so TS doesn't complain.
   */
  interface Ray {
    rulerState?: any;
    terrainRulerFinalState?: any;
  }

  /**
   * Helper from the Hex-Size-Support module used by util.js.
   */
  function findVertexSnapPoint(x: number, y: number, alt: boolean): { x: number; y: number };
}

export {}; 