declare module 'react-simple-maps' {
  import type { ReactNode, CSSProperties, SVGProps } from 'react';

  export interface ProjectionConfig {
    center?: [number, number];
    scale?: number;
    rotate?: [number, number, number];
    parallels?: [number, number];
  }

  export interface ComposableMapProps {
    projection?: string;
    projectionConfig?: ProjectionConfig;
    width?: number;
    height?: number;
    style?: CSSProperties;
    children?: ReactNode;
  }

  export function ComposableMap(props: ComposableMapProps): JSX.Element;

  export interface ZoomableGroupProps {
    center?: [number, number];
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    translateExtent?: [[number, number], [number, number]];
    children?: ReactNode;
  }

  export function ZoomableGroup(props: ZoomableGroupProps): JSX.Element;

  export interface Geography {
    rsmKey: string;
    id: string | number;
    type: string;
    properties: Record<string, unknown>;
    geometry: unknown;
  }

  export interface GeographiesChildrenArg {
    geographies: Geography[];
    outline: Geography;
    sphere: Geography;
  }

  export interface GeographiesProps {
    geography: string | Record<string, unknown>;
    children: (args: GeographiesChildrenArg) => ReactNode;
    parseGeographies?: (geographies: Geography[]) => Geography[];
  }

  export function Geographies(props: GeographiesProps): JSX.Element;

  export interface GeographyStyle {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    outline?: string;
    [key: string]: unknown;
  }

  export interface GeographyProps extends Omit<SVGProps<SVGPathElement>, 'style'> {
    geography: Geography;
    style?: {
      default?: GeographyStyle;
      hover?: GeographyStyle;
      pressed?: GeographyStyle;
    };
    onMouseEnter?: (event: React.MouseEvent<SVGPathElement>) => void;
    onMouseLeave?: (event: React.MouseEvent<SVGPathElement>) => void;
    onClick?: (event: React.MouseEvent<SVGPathElement>) => void;
  }

  export function Geography(props: GeographyProps): JSX.Element;

  export interface MarkerProps extends Omit<SVGProps<SVGGElement>, 'children'> {
    coordinates: [number, number];
    children?: ReactNode;
  }

  export function Marker(props: MarkerProps): JSX.Element;

  export interface LineProps extends SVGProps<SVGPathElement> {
    from: [number, number];
    to: [number, number];
  }

  export function Line(props: LineProps): JSX.Element;

  export interface SphereProps extends SVGProps<SVGPathElement> {
    id?: string;
  }

  export function Sphere(props: SphereProps): JSX.Element;

  export interface GraticuleProps extends SVGProps<SVGPathElement> {
    step?: [number, number];
  }

  export function Graticule(props: GraticuleProps): JSX.Element;

  export interface AnnotationProps {
    subject: [number, number];
    dx?: number;
    dy?: number;
    curve?: number;
    connectorProps?: SVGProps<SVGPathElement>;
    children?: ReactNode;
  }

  export function Annotation(props: AnnotationProps): JSX.Element;

  export function useGeographies(args: { geography: string | Record<string, unknown>; parseGeographies?: (geographies: Geography[]) => Geography[] }): { geographies: Geography[]; outline: Geography; sphere: Geography };

  export function geoCentroid(geography: Geography): [number, number];
}
