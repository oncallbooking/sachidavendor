import React, { useRef } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { parseAutoDetect } from "../utils/dataProcessor";

/**
 * UploadPanel
 * - accepts CSV/JSON/XLSX
 * - parses and returns structured data with schema
 */
export default function UploadPanel({ onDataset }) {
  const fileRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    const name = file.name;
    const ext = name.split(".").pop().toLowerCase();
    if (ext === "csv" || file.type === "text/csv") {
      const text = await file.text();
      const { data, schema } = parseAutoDetect(text, "text/csv");
      onDataset(data, schema, name);
    } else if (ext === "json" || file.type === "application/json") {
      const text = await file.text();
      const arr = JSON.parse(text);
      const { schema } = parseAutoDetect("", "application/json", arr);
      onDataset(arr, schema, name);
    } else if (ext === "xlsx" || ext === "xls") {
      const ab = await file.arrayBuffer();
      const workbook = XLSX.read(ab, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: null });
      const { schema } = parseAutoDetect("", "application/json", json);
      onDataset(json, schema, name);
    } else {
      // try parse as text/csv fallback
      const text = await file.text();
      try {
        const { data, schema } = parseAutoDetect(text, "text/csv");
        onDataset(data, schema, name);
      } catch (e) {
        alert("Unsupported file type");
      }
    }
  };

  const onPicked = (e) => {
    const f = e.target.files[0];
    handleFile(f);
  };

  const onDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div>
      <div className="mb-3 card-title">Upload Data</div>

      <div className="p-4 rounded border border-dashed small-muted panel" onDragOver={(e)=>e.preventDefault()} onDrop={onDrop}>
        <input ref={fileRef} type="file" accept=".csv,.json,.xlsx,.xls" onChange={onPicked} className="hidden" />
        <div className="flex flex-col items-start gap-3">
          <div className="text-sm">Drag & drop CSV / Excel / JSON</div>
          <div className="flex gap-2">
            <button className="button-glass px-3 py-2 rounded-md" onClick={()=>fileRef.current.click()}>Choose File</button>
            <a className="button-glass px-3 py-2 rounded-md" href="/public/assets/sample.csv" download>Download sample.csv</a>
          </div>
          <div className="small-muted text-xs mt-2">Auto-detects numeric, categorical, datetime and geo columns.</div>
        </div>
      </div>
    </div>
  );
}
