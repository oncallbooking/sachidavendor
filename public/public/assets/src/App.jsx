import React, { useEffect, useState } from "react";
import UploadPanel from "./components/UploadPanel";
import ChartBuilder from "./components/ChartBuilder";
import MapPanel from "./components/MapPanel";
import FilterPanel from "./components/FilterPanel";
import InsightPanel from "./components/InsightPanel";
import { parseAutoDetect } from "./utils/dataProcessor";
import sampleCSV from "../public/assets/sample.csv?url";

function App() {
  // app-level state
  const [rawData, setRawData] = useState([]);
  const [schema, setSchema] = useState([]); // column metadata
  const [panels, setPanels] = useState(() => {
    // default dashboard layout: upload + insights + chart + map
    const saved = localStorage.getItem("did_panels");
    return saved ? JSON.parse(saved) : [
      { id: "upload", type: "upload" },
      { id: "insight", type: "insight" },
      { id: "chart", type: "chart", config: null },
      { id: "map", type: "map", config: null }
    ];
  });
  const [filters, setFilters] = useState({});
  const [theme, setTheme] = useState(() => localStorage.getItem("did_theme") || "dark");
  const [activeDatasetName, setActiveDatasetName] = useState("sample.csv");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("did_theme", theme);
  }, [theme]);

  // load sample CSV on mount
  useEffect(() => {
    fetch(sampleCSV).then(r => r.text()).then(text => {
      const { data, schema } = parseAutoDetect(text, "text/csv");
      setRawData(data);
      setSchema(schema);
      localStorage.setItem("did_last_dataset", JSON.stringify({ name: "sample.csv", data, schema }));
    });
  }, []);

  useEffect(() => {
    localStorage.setItem("did_panels", JSON.stringify(panels));
  }, [panels]);

  const replaceDataset = (data, inferredSchema, name = "uploaded") => {
    setRawData(data);
    setSchema(inferredSchema);
    setActiveDatasetName(name);
    // reset filters
    setFilters({});
    localStorage.setItem("did_last_dataset", JSON.stringify({ name, data, schema: inferredSchema }));
  };

  const reorderPanels = (fromIdx, toIdx) => {
    const copy = [...panels];
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    setPanels(copy);
  };

  const removePanel = (idx) => {
    const copy = [...panels];
    copy.splice(idx, 1);
    setPanels(copy);
  };

  const addPanel = (type) => {
    setPanels(prev => [...prev, { id: `${type}_${Date.now()}`, type }]);
  };

  return (
    <div className="min-h-screen p-6">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg panel flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M2 12h20" stroke="#66DFFF" strokeWidth="1.5"/><path d="M8 6h8" stroke="#A1F0FF" strokeWidth="1.5"/></svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Data Intelligence Dashboard</h1>
            <div className="text-sm small-muted">Futuristic, open-source, client-only analytics</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="small-muted mr-2">Dataset:</div>
          <div className="panel px-3 py-2 rounded-md small-muted">{activeDatasetName}</div>

          <button className="button-glass px-3 py-2 rounded-md" onClick={() => addPanel("chart")}>+ Chart</button>
          <button className="button-glass px-3 py-2 rounded-md" onClick={() => addPanel("map")}>+ Map</button>

          <select value={theme}
            onChange={(e)=>setTheme(e.target.value)}
            className="panel px-3 py-2 rounded-md small-muted">
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>
      </header>

      <main className="grid lg:grid-cols-4 gap-4">
        <aside className="lg:col-span-1 space-y-4">
          <div className="panel p-4">
            <UploadPanel onDataset={(data, schema, name)=>replaceDataset(data,schema,name)} />
          </div>
          <div className="panel p-4">
            <FilterPanel schema={schema} data={rawData} filters={filters} setFilters={setFilters} />
          </div>
          <div className="panel p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="card-title">Quick Actions</div>
            </div>
            <div className="flex flex-col gap-2">
              <button className="button-glass px-3 py-2 rounded-md text-sm" onClick={()=>{
                const s = localStorage.getItem("did_last_dataset");
                if(s) {
                  const parsed = JSON.parse(s);
                  replaceDataset(parsed.data, parsed.schema, parsed.name);
                } else alert("No saved dataset found.");
              }}>Reload last dataset</button>

              <button className="button-glass px-3 py-2 rounded-md text-sm" onClick={()=>{
                localStorage.clear(); alert("Local storage cleared.");
              }}>Clear local storage</button>

              <button className="button-glass px-3 py-2 rounded-md text-sm" onClick={()=>{
                const state = { panels, filters, theme, activeDatasetName };
                const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "did-dashboard-state.json";
                a.click();
              }}>Export Layout (JSON)</button>
            </div>
          </div>
        </aside>

        <section className="lg:col-span-3 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {panels.map((p, idx) => {
              if(p.type === "upload") {
                return <div key={p.id} className="panel p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="card-title">Upload / Data Preview</div>
                    <div className="flex gap-2">
                      <button className="small-muted" onClick={()=>removePanel(idx)}>✕</button>
                      <div className="small-muted cursor-grab" draggable onDragStart={(e)=>e.dataTransfer.setData("text/plain", idx)}>↕</div>
                    </div>
                  </div>
                  <div className="text-sm small-muted mb-2">Columns detected: {schema.length}</div>
                  <div className="max-h-44 overflow-auto bg-[#071023] p-2 rounded">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs small-muted">
                          {schema.slice(0,8).map(s=> <th key={s.name} className="text-left pr-2">{s.name}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {rawData.slice(0,6).map((r, ri)=>(
                          <tr key={ri}>
                            {schema.slice(0,8).map(c=> <td key={c.name} className="pr-2 text-sm">{String(r[c.name] ?? "")}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>;
              }
              if(p.type === "insight") {
                return <div key={p.id} className="panel p-4">
                  <div className="flex justify-between items-center mb-3">
                    <div className="card-title">AI Insights</div>
                    <div className="flex gap-2">
                      <button className="small-muted" onClick={()=>removePanel(idx)}>✕</button>
                      <div className="small-muted cursor-grab" draggable onDragStart={(e)=>e.dataTransfer.setData("text/plain", idx)}>↕</div>
                    </div>
                  </div>
                  <InsightPanel data={rawData} schema={schema} filters={filters} />
                </div>;
              }
              if(p.type === "chart") {
                return <div key={p.id} className="panel p-4">
                  <div className="flex justify-between items-center mb-3">
                    <div className="card-title">Chart Builder</div>
                    <div className="flex gap-2">
                      <button className="small-muted" onClick={()=>removePanel(idx)}>✕</button>
                      <div className="small-muted cursor-grab" draggable onDragStart={(e)=>e.dataTransfer.setData("text/plain", idx)}>↕</div>
                    </div>
                  </div>
                  <ChartBuilder data={rawData} schema={schema} filters={filters} />
                </div>;
              }
              if(p.type === "map") {
                return <div key={p.id} className="panel p-4">
                  <div className="flex justify-between items-center mb-3">
                    <div className="card-title">India Map</div>
                    <div className="flex gap-2">
                      <button className="small-muted" onClick={()=>removePanel(idx)}>✕</button>
                      <div className="small-muted cursor-grab" draggable onDragStart={(e)=>e.dataTransfer.setData("text/plain", idx)}>↕</div>
                    </div>
                  </div>
                  <div style={{height: 360}}>
                    <MapPanel data={rawData} schema={schema} />
                  </div>
                </div>;
              }
              return null;
            })}
          </div>
        </section>
      </main>

      <footer className="mt-8 small-muted text-center">
        Built with ❤️ • Neo-futuristic UI • Works 100% client-side
      </footer>
    </div>
  );
}

export default App;
