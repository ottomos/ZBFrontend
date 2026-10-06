import React, { useState, useEffect } from "react";

interface TransactionRow {
  Symbol: string;
  Quantity: number;
  Price: number;
  Side: string;
  Venue: string;
  Timestamp: string;
  Strategy?: string;
  [key: string]: string | number | undefined;
}

interface TransactionTableProps {
  title: string;
  rows: TransactionRow[];
}

export function TransactionTable({ title, rows }: TransactionTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredRows, setFilteredRows] = useState<TransactionRow[]>(rows);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredRows(rows);
      return;
    }
    setFilteredRows(
      rows.filter(row =>
        Object.values(row).some(val =>
          String(val).toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    );
  }, [searchTerm, rows]);

  return (
    <div className="transaction-table">
      <h3>{title}</h3>
      <input
        type="text"
        placeholder="Search..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        style={{ marginBottom: 8 }}
      />
      <table>
        <thead>
          <tr>
            {Object.keys(rows[0] || {}).map(col => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((row, idx) => (
            <tr key={idx}>
              {Object.keys(row).map(col => (
                <td key={col}>{row[col]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
