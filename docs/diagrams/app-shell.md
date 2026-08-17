# App shell — layout and scroll

Two invariants that are easy to break silently, both learned the hard way on 2026-08-17.

## Structure

```mermaid
flowchart TB
    subgraph doc["document — THE SCROLLER"]
        direction TB
        backdrop["div.min-h-dvh.bg-cove-backdrop<br/>(centres the shell)"]
        subgraph shell["div.min-h-dvh.max-w-[520px] — flex column"]
            direction TB
            main["main.flex-1<br/><b>no overflow-*</b><br/>pad: safe-area + 110px nav clearance"]
            page["the active page<br/>(Now / Tasks / Capture / Browse / Me / …)"]
            main --- page
        end
        nav["nav.fixed.bottom-0.max-w-[520px]<br/>5 tabs · never a badge or count"]
        backdrop --- shell
    end

    shell -.->|"content taller than the viewport<br/>scrolls the DOCUMENT"| doc
    nav -.->|"overlays the shell;<br/>cleared by main's bottom padding"| shell
```

## Why `main` must not be a scroll container

`main` is `flex-1` inside a `min-h-dvh` (auto-height) column, so it always grows to the full
content height and can never scroll itself. Declaring it `overflow-y-auto` anyway made Chrome
treat it as the wheel target and **swallow every wheel event over the app** rather than chaining
to the document.

```mermaid
sequenceDiagram
    participant U as User (wheel over the app)
    participant M as main (overflow-y-auto)
    participant D as document

    rect rgb(253, 238, 218)
        Note over U,D: BROKEN — before 2026-08-17
        U->>M: wheel
        M->>M: scrollHeight === clientHeight<br/>nothing to scroll
        M--xD: no chaining
        Note over U: page moves 0px
    end

    rect rgb(230, 244, 236)
        Note over U,D: FIXED — main has no overflow
        U->>D: wheel
        D->>D: scrolls
        Note over U: page moves
    end
```

Symptom to recognise: the page scrolls when the cursor sits on the backdrop *beside* the shell,
but not when it sits on the content. Measured before the fix — 0px inside, 500px outside.

## Why viewport breakpoints don't work in here

The shell is capped at `max-w-[520px]`, but Tailwind's `sm:` / `md:` / `lg:` key off the
**viewport**. On a desktop browser the viewport is ~1920px, so every desktop layout activated
inside a 520px column.

```mermaid
flowchart LR
    vp["viewport 1920px<br/>lg: MATCHES ✓"] --> shellw["shell 520px<br/>the real constraint"]
    shellw --> bad["lg:grid-cols-[1fr_21rem]<br/>→ list squeezed to ~100px"]
    shellw --> bad2["lg: sidebar 256px<br/>→ chat ~180px, 3 words a line"]
    shellw --> good["one layout that fits 520px<br/>2 cols for small tiles, 1 for wide inputs"]

    style bad fill:#fbe9ec,stroke:#d9647a
    style bad2 fill:#fbe9ec,stroke:#d9647a
    style good fill:#e6f4ec,stroke:#5cb586
```

**Rule:** no viewport breakpoint for layout inside the shell. They remain valid in surfaces that
render *outside* it — `Modal`, `Toast`, `LoginScreen`, `CheckInGate`, `CloseDayOverlay` — because
those really are viewport-sized.
