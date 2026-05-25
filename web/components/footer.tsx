export function Footer() {
  return (
    <footer className="py-5 px-6 border-t border-border grid grid-cols-3 items-center text-[12px] text-fg-4 max-w-[960px] mx-auto w-full">
      <span>Sapling · v0.1.0</span>
      <span className="flex items-center justify-center gap-1">
        Built with{" "}
        <span style={{color: "#E55353"}} aria-label="love">
          ♥
        </span>{" "}
        by Justalab
      </span>
      <span className="flex justify-end">
        <a
          href="https://github.com/JustaName-id"
          target="_blank"
          rel="noreferrer"
          className="text-fg-3 hover:text-fg no-underline transition-colors"
        >
          GitHub
        </a>
      </span>
    </footer>
  );
}
