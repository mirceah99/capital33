import express from "express";
import * as fs from "fs";
import * as path from "path";
import { ReflowService } from "../reflow/reflow.service";

const app = express();
app.use(express.json());

const DB_DIR = path.join(__dirname, "..", "db");
const SCENARIOS_DIR = path.join(DB_DIR, "scenarios");
const CURRENT = path.join(DB_DIR, "currentScenario.json");
const RESOLVED = path.join(DB_DIR, "currentResolvedScenario.json");
const UI_DIR = path.join(__dirname, "..", "ui");

const readJson = (file: string) => {
  if (!fs.existsSync(file) || fs.readFileSync(file, "utf-8").trim() === "") return null;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
};
const writeJson = (file: string, data: unknown) =>
  fs.writeFileSync(file, JSON.stringify(data, null, 2));

// list every scenario available in the db/scenarios folder
app.get("/api/scenarios", (_req, res) => {
  const files = fs.readdirSync(SCENARIOS_DIR).filter((f) => f.endsWith(".json"));
  res.json(
    files.map((f) => ({ file: f, name: readJson(path.join(SCENARIOS_DIR, f))?.name ?? f }))
  );
});

// the currently loaded (unresolved) scenario
app.get("/api/current", (_req, res) => res.json(readJson(CURRENT)));

// the last resolved scenario (what the UI renders)
app.get("/api/resolved", (_req, res) => res.json(readJson(RESOLVED)));

// load a scenario by file name -> becomes the current scenario
app.post("/api/load/:file", (req, res) => {
  const src = path.join(SCENARIOS_DIR, req.params.file);
  if (!fs.existsSync(src)) return res.status(404).json({ error: "scenario not found" });
  const scenario = readJson(src);
  writeJson(CURRENT, scenario);
  res.json(scenario);
});

// run the reflow algorithm on the current scenario and persist the result
app.post("/api/resolve", (_req, res) => {
  const scenario = readJson(CURRENT);
  if (!scenario) return res.status(400).json({ error: "no current scenario loaded" });
  try {
    new ReflowService().reflow(
      scenario.settlementTasks,
      scenario.settlementChannels,
      scenario.tradeOrders
    );
    writeJson(RESOLVED, scenario);
    res.json(scenario);
  } catch (err) {
    res.status(422).json({ error: String(err) });
  }
});

app.use(express.static(UI_DIR));

const PORT = 3000;
app.listen(PORT, () => console.log(`Capital33 UI + API running on http://localhost:${PORT}`));
