'use client';
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "../types/user";
import { CustomerTransactionsTable } from "../components/CustomerTransactionsTable";
import { InternalTransactionsTable } from "../components/InternalTransactionsTable";
import { useEntity } from "../context/EntityContext";
import { kafkaPollInterval } from "../lib/polling";
import { usePersistedState } from "../lib/usePersistedState";

type TransactionTableType = 'customer' | 'internal';
const TRANSACTIONS_POLL_MS = kafkaPollInterval(1_000);

export default function TransactionsPage() {
  const [customerRows, setCustomerRows] = useState<any[]>([]);
  const [internalRows, setInternalRows] = useState<any[]>([]);
  const [positionRows, setPositionRows] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { selectedEntity, setSelectedEntity } = useEntity();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  // Fetch user info and handle authentication
  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch("/api/users/me");
        const data = await res.json();
        if (!data.success) {
          router.push("/login");
          return;
        }
        setCurrentUser(data.user);
        setIsAuthenticated(true);
        // Restrict entity selection for non-COE/Management/Group Head Trader
        const normalizedUserEntity = String(data.user.entity || '').trim().toUpperCase();
        const normalizedSelectedEntity = String(selectedEntity || '').trim().toUpperCase();
        const isCoE = normalizedUserEntity === "ALL";
        const isGroupHeadTrader = String(data.user.role || '').trim().toUpperCase() === "GROUP HEAD TRADER";
        if (!isCoE && !isGroupHeadTrader && normalizedUserEntity && normalizedSelectedEntity !== normalizedUserEntity) {
          setSelectedEntity(String(data.user.entity || '').trim());
        }
      } catch (error) {
        router.push("/login");
      }
    }
    fetchUser();
  }, [router, selectedEntity, setSelectedEntity]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    const fetchData = async () => {
      try {
        const customerRes = await fetch(`/api/customer-transactions?profile=${selectedEntity}`);
        const customerData = await customerRes.json();
        setCustomerRows(
          (customerData.data || []).map((row: any) => ({
            ...row,
            'Tran Price': row.TranPrice,
            Entity: row.Entity || customerData.entity,
            'Customer ID': row.CustomerID || row.CustomerId || row.Entity || '',
            'Bid Price': row.BidPrice || '',
            'Ask Price': row.AskPrice || '',
            // Preserve numeric zero values; only fallback to empty when null/undefined
            'Sales PnL': row.SalesPnL ?? 0,
            'Tran ID': row.TranID || row.TranId || '',
          }))
        );
      } catch (error) {
        console.error("Failed to load customer transactions", error);
      }

      try {
        const internalRes = await fetch(`/api/internal-transactions?profile=${selectedEntity}`);
        const internalData = await internalRes.json();
        setInternalRows(
          (internalData.data || []).map((row: any) => ({
            ...row,
            'Tran Price': row.TranPrice,
            Entity: row.Entity || internalData.entity,
          }))
        );
      } catch (error) {
        console.error("Failed to load internal transactions", error);
      }

      try {
        const positionRes = await fetch(`/api/positions?profile=${selectedEntity}`);
        if (positionRes.ok) {
          const positionData = await positionRes.json();
          setPositionRows(positionData.data || []);
        } else {
          console.error('Failed to load positions', positionRes.status);
        }
      } catch (error) {
        console.error('Failed to load positions', error);
      }
    };

    fetchData();
    intervalId = setInterval(fetchData, TRANSACTIONS_POLL_MS);

    return () => clearInterval(intervalId);
  }, [selectedEntity]);

  const [leftWidth, setLeftWidth] = usePersistedState('ui.layout.transactions.leftWidth', 0.65); // fraction of width, default wider left
  const [dragging, setDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartWidth, setDragStartWidth] = useState(0.5);
  const [leftTableType, setLeftTableType] = useState<TransactionTableType>('customer');
  const [rightTableType, setRightTableType] = useState<TransactionTableType>('internal');
  const [leftVisible, setLeftVisible] = useState(true);
  const [rightVisible, setRightVisible] = useState(true);

  function handleMouseDown(e: React.MouseEvent) {
    if (!leftVisible || !rightVisible) return;
    setDragging(true);
    setDragStartX(e.clientX);
    setDragStartWidth(leftWidth);
    document.body.style.cursor = 'col-resize';
  }
  function handleMouseMove(e: MouseEvent) {
    if (!dragging || !leftVisible || !rightVisible) return;
    const container = document.getElementById('transactions-table-container');
    if (!container) return;
    const width = container.clientWidth;
    const delta = e.clientX - dragStartX;
    let newLeft = dragStartWidth + delta / width;
    newLeft = Math.max(0.2, Math.min(0.8, newLeft));
    setLeftWidth(newLeft);
  }
  function handleMouseUp() {
    setDragging(false);
    document.body.style.cursor = '';
  }
  function renderTransactionColumn(position: 'left' | 'right') {
    const visible = position === 'left' ? leftVisible : rightVisible;
    if (!visible) return null;
    const tableType = position === 'left' ? leftTableType : rightTableType;
    const rows = tableType === 'customer' ? customerRows : internalRows;
    const TableComponent = tableType === 'customer' ? CustomerTransactionsTable : InternalTransactionsTable;
    const width = position === 'left'
      ? rightVisible ? `calc(${leftWidth * 100}% - 4px)` : '100%'
      : leftVisible ? `calc(${(1 - leftWidth) * 100}% - 4px)` : '100%';
    const marginLeft = position === 'right' && leftVisible ? '2px' : '0';
    const onTableChange = (value: string) => {
      const normalized: TransactionTableType = value === 'internal' ? 'internal' : 'customer';
      if (position === 'left') {
        setLeftTableType(normalized);
      } else {
        setRightTableType(normalized);
      }
    };
    const onClose = position === 'left' ? () => setLeftVisible(false) : () => setRightVisible(false);
    const title = tableType === 'customer' ? 'Customer Transactions' : 'Internal Transactions';

    return (
      <div className="p-2" style={{ width, marginLeft }} key={`${position}-${tableType}`}>
        <TableComponent
          rows={rows}
          title={title}
          currentType={tableType}
          onTableChange={onTableChange}
          onClose={onClose}
        />
      </div>
    );
  }
  useEffect(() => {
    if (!dragging) return;
    function move(e: MouseEvent) { handleMouseMove(e); }
    function up() { handleMouseUp(); }
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [dragging]);

  if (!isAuthenticated || !currentUser) {
    return <div className="h-screen bg-[#0A1929] flex items-center justify-center text-white">Loading...</div>;
  }

  const handleLogout = () => {
    fetch("/api/users/logout", { method: "POST" });
    router.push("/login");
  };

  const isCoE = currentUser.entity && currentUser.entity.trim().toUpperCase() === "ALL";
  const isGroupHeadTrader = currentUser.role === "Group Head Trader";

  return (
    <div className="h-full bg-[#0A1929] flex flex-col overflow-hidden">
      <div className="flex flex-row w-full flex-1 relative min-h-0" id="transactions-table-container">
        {renderTransactionColumn('left')}
        {leftVisible && rightVisible && (
          <div
            style={{
              position: 'absolute',
              left: `calc(${leftWidth * 100}% - 12px)`,
              top: 0,
              height: '100%',
              width: '16px',
              zIndex: 10,
              cursor: 'col-resize',
              background: dragging ? '#2C5680' : 'transparent',
              transition: 'background 0.2s',
            }}
            onMouseDown={handleMouseDown}
          >
            <div style={{ width: '4px', height: '100%', margin: '0 auto', background: '#22456b', borderRadius: '2px' }} />
          </div>
        )}
        {renderTransactionColumn('right')}
        {!leftVisible && !rightVisible && (
          <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white">
            No transaction tables are visible.
          </div>
        )}
      </div>
    </div>
  );
}
