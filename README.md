## Energy Management Calendar

Interactive operations calendar designed for energy and sustainability teams. Visualize daily load, schedule demand response actions, and track how consumption trends against a monthly target.

### Highlights
- Month view with color-coded usage tiles, quick navigation, and solar/grid indicators
- Detailed breakdown panel for the selected day with peak/off-peak usage, carbon metrics, and planned actions
- Log custom load reduction, shifting, or generation tasks with built-in status tracking
- Weekly trend mini-chart and demand response event timeline with incentives
- Optimization playbook with curated recommendations for the current month

### Tech stack
- [Next.js App Router](https://nextjs.org/docs/app) with TypeScript
- Tailwind CSS (Next 14+ built-in `@tailwindcss/postcss`)
- Deterministic sample data generator (`src/lib/energyData.ts`) for repeatable demo states

### Local development
```bash
npm install
npm run dev
```

### Production build
```bash
npm run build
npm start
```

### Deploy to Vercel
```bash
vercel deploy --prod --yes --token $VERCEL_TOKEN --name agentic-bee241ed
```
