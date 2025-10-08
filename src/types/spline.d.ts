declare namespace JSX {
  interface IntrinsicElements {
    'spline-viewer': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        url?: string;
        loading?: 'lazy' | 'eager';
        onLoad?: () => void;
        onError?: () => void;
      },
      HTMLElement
    >;
  }
}
