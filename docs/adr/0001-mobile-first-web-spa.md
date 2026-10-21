# ADR-0001: Build a mobile-first web SPA instead of native apps

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-10-21 |
| **Deciders** | Charlie Chiu |

## Context

The Task & Team document planned a React Native + Expo app. The project does not need to ship to iOS or Android app stores. The core experiences, assisted logging and nutrition history, depend heavily on rich, custom, interactive charts and multi-step review flows. The web ecosystem supports these better than React Native, through SVG, D3, and the many web charting libraries. Usability sessions and demos also benefit from a URL that works on any participant's phone without installing anything.

## Decision

Build the frontend as a **mobile-first, web-based single-page application** using React and TypeScript. Design primarily for phone-sized viewports (≈360–430 px wide), with layouts that scale up to tablet and desktop.

- Photo capture uses the browser file input with camera capture (`<input type="file" accept="image/*" capture="environment">`), which opens the camera on mobile browsers.
- No native apps and no app-store distribution.
- Installable PWA support is optional and not required for the MVP.

The specific build tool, router, state library, and charting library will be chosen in `02-architecture/tech-stack.md`.

## Alternatives considered

| Option | Pros | Cons |
|---|---|---|
| React Native + Expo (original plan) | Native camera and feel; one codebase for iOS/Android | Weaker charting ecosystem; device builds and installs slow down testing; native distribution is not required |
| Responsive web SPA (chosen) | Strong data-viz tooling; zero install for participants; fast iteration and deployment | Less native feel; camera access is limited to browser capabilities |
| Server-rendered web app | Simple; good first load | Interactive, linked visualizations and multi-step review flows are more natural in a client-side app |

## Consequences

- Task & Team items "Initialize React Native + Expo project" become "Initialize React + TypeScript SPA".
- All UI must be tested on real mobile browsers (iOS Safari and Android Chrome), not only desktop devtools.
- Touch targets, one-handed use, and small-screen chart readability become explicit design requirements in `06-ux/ui-guidelines.md`.
- The frontend and backend are deployed separately; hosting is an open question.
