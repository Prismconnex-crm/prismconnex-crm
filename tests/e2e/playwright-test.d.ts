declare module "@playwright/test" {
  export const expect: any;
  export const test: {
    describe(name: string, fn: () => void): void;
    (name: string, fn: (args: { page: any }) => void | Promise<void>): void;
  };
}
