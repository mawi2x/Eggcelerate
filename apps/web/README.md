# EGGCELERATE Web

This directory contains the implemented Vite + React web dashboard. The original UI project is available in [Figma](https://www.figma.com/design/hN27kR6Y7yH7YbSebrBhPU/ui---eggcelerate).

Run commands from the repository root using the pnpm workspace:

```bash
pnpm install --frozen-lockfile
pnpm --filter eggcelerate-ui dev
```

Create a production build with:

```bash
pnpm --filter eggcelerate-ui build
```

The Docker build uses the repository root as its context so it can consume the single workspace lockfile:

```bash
docker build -f apps/web/Dockerfile .
```
