declare module "svg-maps__common" {
  export interface Location {
    id: string;
    name: string;
    path: string;
  }

  export interface Map {
    label: string;
    viewBox: string;
    locations: Location[];
  }
}

declare module "@svg-maps/brazil" {
  import type { Map } from "svg-maps__common";
  const map: Map;
  export default map;
}
