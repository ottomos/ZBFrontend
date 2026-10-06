'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable } from './DataTable';
import { StrategyTable } from './StrategyTable';
import { ExecutionTable } from './ExecutionTable';
import { RiskTable } from './RiskTable';
import { CustomerTransactionsTable } from './CustomerTransactionsTable';
import { InternalTransactionsTable } from './InternalTransactionsTable';
import { ProviderTable } from './ProviderTable';
import { TableContainer } from './TableContainer';
import { SplitBar } from './SplitBar';
import { User, canUserTrade } from '../types/user';
import { useConfig } from '../context/ConfigContext';
import { useEntity } from '../context/EntityContext';
import { kafkaPollInterval } from '../lib/polling';
import { usePersistedState } from '../lib/usePersistedState';
import ManualTradeTable from './ManualTradeTable';

const LIVE_DATA_POLL_MS = kafkaPollInterval(1_000);

export function Dashboard() {
  const [, startTransition] = useTransition();
    const [customerTransactions, setCustomerTransactions] = useState<any[]>([]);
    const [internalTransactions, setInternalTransactions] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const config = useConfig();
  
  // 2x2 grid: 2 rows, 2 columns per row
  const [rowHeights, setRowHeights] = usePersistedState('ui.layout.dashboard.rowHeights', [0.5, 0.5]);
  const [topColWidths, setTopColWidths] = usePersistedState('ui.layout.dashboard.topColWidths', [0.5, 0.5]);
  const [bottomColWidths, setBottomColWidths] = usePersistedState('ui.layout.dashboard.bottomColWidths', [0.5, 0.5]);

  // Track table type for each quadrant
  const [topLeftType, setTopLeftType] = useState('position');
  const [topRightType, setTopRightType] = useState('strategy');
  const [bottomLeftType, setBottomLeftType] = useState('execution');
  const [bottomRightType, setBottomRightType] = useState('risk');

  const handleTopLeftTypeChange = (nextType: string) => {
    startTransition(() => {
      setTopLeftType(nextType);
    });
  };
  const handleTopRightTypeChange = (nextType: string) => {
    startTransition(() => {
      setTopRightType(nextType);
    });
  };
  const handleBottomLeftTypeChange = (nextType: string) => {
    startTransition(() => {
      setBottomLeftType(nextType);
    });
  };
  const handleBottomRightTypeChange = (nextType: string) => {
    startTransition(() => {
      setBottomRightType(nextType);
    });
  };

  const [positionData, setPositionData] = useState<any[]>([]);
  const [strategyData, setStrategyData] = useState<any[]>([]);
  const [executionData, setExecutionData] = useState<any[]>([]);
  const [riskData, setRiskData] = useState<any[]>([]);
  
  const { selectedEntity, setSelectedEntity } = useEntity();

  const rowsForType = (type: string) => {
    switch (type) {
      case 'position':
        return positionData;
      case 'strategy':
        return strategyData;
      case 'providers':
        return riskData;
      case 'execution':
        return executionData;
      case 'risk':
        return riskData;
      default:
        return [];
    }
  };

  // Lock entity for non-CoE and non-Group Head Trader users
  useEffect(() => {
        const fetchCustomerTransactions = async () => {
          try {
            const url = `/api/customer-transactions?profile=${selectedEntity}`;
            const res = await fetch(url);
            if (!res.ok) return;
            const response = await res.json();
            setCustomerTransactions(response.data || []);
          } catch (error) {
            console.error('Error fetching customer transactions:', error);
          }
        };
        const fetchInternalTransactions = async () => {
          try {
            const url = `/api/internal-transactions?profile=${selectedEntity}`;
            const res = await fetch(url);
            if (!res.ok) return;
            const response = await res.json();
            setInternalTransactions(response.data || []);
          } catch (error) {
            console.error('Error fetching internal transactions:', error);
          }
        };
    if (!currentUser) return;
    const normalizedUserEntity = String(currentUser.entity || '').trim().toUpperCase();
    const normalizedSelectedEntity = String(selectedEntity || '').trim().toUpperCase();
    const isCoE = normalizedUserEntity === 'ALL';
    const isGroupHeadTrader = String(currentUser.role || '').trim().toUpperCase() === 'GROUP HEAD TRADER';
    if (!isCoE && !isGroupHeadTrader && normalizedUserEntity && normalizedSelectedEntity !== normalizedUserEntity) {
      setSelectedEntity(String(currentUser.entity || '').trim());
    }
  }, [currentUser, selectedEntity, setSelectedEntity]);

  // Track which quadrants are visible
  const [visibleTables, setVisibleTables] = useState({
    topLeft: true,
    topRight: true,
    bottomLeft: true,
    bottomRight: true,
  });

  React.useEffect(() => {
    if (!currentUser) return;
    const userCanTrade = canUserTrade(currentUser, selectedEntity);
    if (userCanTrade) return;

    if (topLeftType === 'manual-trade') setTopLeftType('strategy');
    if (topLeftType === 'providers') setTopLeftType('strategy');
    if (topRightType === 'manual-trade') setTopRightType('strategy');
    if (topRightType === 'providers') setTopRightType('strategy');
    if (bottomLeftType === 'manual-trade') setBottomLeftType('strategy');
    if (bottomLeftType === 'providers') setBottomLeftType('strategy');
    if (bottomRightType === 'manual-trade') setBottomRightType('strategy');
    if (bottomRightType === 'providers') setBottomRightType('strategy');
  }, [currentUser, selectedEntity, topLeftType, topRightType, bottomLeftType, bottomRightType]);

  // Handle client-side mounting and authentication
  useEffect(() => {
    // Check authentication
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      // No user logged in, redirect to login
      router.push('/login');
      return;
    }

    try {
      const user = JSON.parse(userStr);
      setCurrentUser(user);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Error parsing user data:', error);
      localStorage.removeItem('user');
      router.push('/login');
      return;
    }

    setMounted(true);
  }, [router]);

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/login');
  };

  // Fetch data for each table type
  useEffect(() => {
    if (!mounted || !isAuthenticated) {
      console.log('Skipping fetch: mounted=', mounted, 'auth=', isAuthenticated);
      return;
    }

    console.log('Fetching data for entity:', selectedEntity);

    const fetchPositionData = async () => {
      try {
        const url = `/api/positions?profile=${selectedEntity}`;
        console.log('Fetching positions from:', url);
        const res = await fetch(url);
        if (!res.ok) {
          console.error('Position API error status:', res.status);
          const text = await res.text();
          console.error('Position API response:', text);
          return;
        }
        const response = await res.json();
        // Restore original behavior: set to returned data or empty array
        startTransition(() => {
          setPositionData(response.data || []);
        });
      } catch (error) {
        console.error('Error fetching position data:', error);
      }
    };

    const fetchStrategyData = async () => {
      try {
        const url = `/api/strategy?profile=${selectedEntity}`;
        console.log('Fetching strategy from:', url);
        const res = await fetch(url);
        if (!res.ok) {
          console.error('Strategy API error status:', res.status);
          const text = await res.text();
          console.error('Strategy API response:', text);
          return;
        }
        const response = await res.json();
        startTransition(() => {
          setStrategyData(response.data || []);
        });
      } catch (error) {
        console.error('Error fetching strategy data:', error);
      }
    };

    const fetchExecutionData = async () => {
      try {
        const url = `/api/execution?profile=${selectedEntity}`;
        console.log('Fetching execution from:', url);
        const res = await fetch(url);
        if (!res.ok) {
          console.error('Execution API error status:', res.status);
          const text = await res.text();
          console.error('Execution API response:', text);
          return;
        }
        const response = await res.json();
        startTransition(() => {
          setExecutionData(response.data || []);
        });
      } catch (error) {
        console.error('Error fetching execution data:', error);
      }
    };

    const fetchRiskData = async () => {
      try {
        const url = `/api/risk-monitor?profile=${selectedEntity}`;
        console.log('Fetching risk-monitor from:', url);
        const res = await fetch(url);
        if (!res.ok) {
          console.error('Risk API error status:', res.status);
          const text = await res.text();
          console.error('Risk API response:', text);
          return;
        }
        const response = await res.json();
        startTransition(() => {
          setRiskData(response.data || []);
        });
      } catch (error) {
        console.error('Error fetching risk data:', error);
      }
    };

    const fetchCustomerTransactionsData = async () => {
      try {
        const url = `/api/customer-transactions?profile=${selectedEntity}`;
        console.log('Fetching customer transactions from:', url);
        const res = await fetch(url);
        if (!res.ok) {
          console.error('Customer transactions API error status:', res.status);
          const text = await res.text();
          console.error('Customer transactions API response:', text);
          return;
        }
        const response = await res.json();
        startTransition(() => {
          setCustomerTransactions(response.data || []);
        });
      } catch (error) {
        console.error('Error fetching customer transactions:', error);
      }
    };

    const fetchInternalTransactionsData = async () => {
      try {
        const url = `/api/internal-transactions?profile=${selectedEntity}`;
        console.log('Fetching internal transactions from:', url);
        const res = await fetch(url);
        if (!res.ok) {
          console.error('Internal transactions API error status:', res.status);
          const text = await res.text();
          console.error('Internal transactions API response:', text);
          return;
        }
        const response = await res.json();
        startTransition(() => {
          setInternalTransactions(response.data || []);
        });
      } catch (error) {
        console.error('Error fetching internal transactions:', error);
      }
    };
    fetchCustomerTransactionsData();
    fetchInternalTransactionsData();

    // Only fetch data for tables that are currently visible/selected
    const needForType = (type: string) => {
      return (
        (visibleTables.topLeft && topLeftType === type) ||
        (visibleTables.topRight && topRightType === type) ||
        (visibleTables.bottomLeft && bottomLeftType === type) ||
        (visibleTables.bottomRight && bottomRightType === type)
      );
    };

    if (needForType('position')) fetchPositionData();
    if (needForType('strategy')) fetchStrategyData();
    if (needForType('execution')) fetchExecutionData();
    if (needForType('risk') || needForType('providers')) fetchRiskData();

    const shouldPollPosition = needForType('position');
    const shouldPollStrategy = needForType('strategy');
    const shouldPollExecution = needForType('execution');
    const shouldPollRisk = needForType('risk') || needForType('providers');
    const shouldPollCustomerTransactions = needForType('customer-transactions');
    const shouldPollInternalTransactions = needForType('internal-transactions');

    // Set up intervals only for currently visible/selected table types.
    const customerInterval = shouldPollCustomerTransactions ? setInterval(fetchCustomerTransactionsData, LIVE_DATA_POLL_MS) : null;
    const internalInterval = shouldPollInternalTransactions ? setInterval(fetchInternalTransactionsData, LIVE_DATA_POLL_MS) : null;
    const positionInterval = shouldPollPosition ? setInterval(fetchPositionData, LIVE_DATA_POLL_MS) : null;
    const strategyInterval = shouldPollStrategy ? setInterval(fetchStrategyData, LIVE_DATA_POLL_MS) : null;
    const executionInterval = shouldPollExecution ? setInterval(fetchExecutionData, LIVE_DATA_POLL_MS) : null;
    const riskInterval = shouldPollRisk ? setInterval(fetchRiskData, LIVE_DATA_POLL_MS) : null;
    return () => {
      if (positionInterval) clearInterval(positionInterval);
      if (strategyInterval) clearInterval(strategyInterval);
      if (executionInterval) clearInterval(executionInterval);
      if (riskInterval) clearInterval(riskInterval);
      if (customerInterval) clearInterval(customerInterval);
      if (internalInterval) clearInterval(internalInterval);
    };
  }, [mounted, isAuthenticated, selectedEntity, config, visibleTables, topLeftType, topRightType, bottomLeftType, bottomRightType]);

  // Split bar handlers
  const handleTopColSplitDrag = (delta: number) => {
    const container = document.getElementById('dashboard-table-container');
    if (!container) return;
    const width = container.clientWidth;
    const percentDelta = delta / width;
    setTopColWidths(prev => {
      let left = Math.max(prev[0] + percentDelta, 0.2);
      let right = Math.max(prev[1] - percentDelta, 0.2);
      const total = left + right;
      return [left / total, right / total];
    });
  };
  const handleBottomColSplitDrag = (delta: number) => {
    const container = document.getElementById('dashboard-table-container');
    if (!container) return;
    const width = container.clientWidth;
    const percentDelta = delta / width;
    setBottomColWidths(prev => {
      let left = Math.max(prev[0] + percentDelta, 0.2);
      let right = Math.max(prev[1] - percentDelta, 0.2);
      const total = left + right;
      return [left / total, right / total];
    });
  };
  const handleRowSplitDrag = (delta: number) => {
    const container = document.getElementById('dashboard-table-container');
    if (!container) return;
    const height = container.clientHeight;
    const percentDelta = delta / height;
    setRowHeights(prev => {
      let up = Math.max(prev[0] + percentDelta, 0.2);
      let down = Math.max(prev[1] - percentDelta, 0.2);
      const total = up + down;
      return [up / total, down / total];
    });
  };

  // Remove table handler
  const handleRemoveTable = (quadrant: string) => {
    setVisibleTables(prev => ({ ...prev, [quadrant]: false }));
  };

  // Helper to get visible tables and their configs
  const getVisibleTableConfigs = () => {
    const configs = [];
      if (visibleTables.topLeft) configs.push({
        type: topLeftType,
        rows: rowsForType(topLeftType),
      currentType: topLeftType,
      selectedEntity: selectedEntity,
      onTableChange: handleTopLeftTypeChange,
      onClose: () => handleRemoveTable('topLeft'),
    });
      if (visibleTables.topRight) configs.push({
        type: topRightType,
        rows: rowsForType(topRightType),
      currentType: topRightType,
      selectedEntity: selectedEntity,
      onTableChange: handleTopRightTypeChange,
      onClose: () => handleRemoveTable('topRight'),
    });
      if (visibleTables.bottomLeft) configs.push({
        type: bottomLeftType,
        rows: rowsForType(bottomLeftType),
      currentType: bottomLeftType,
      selectedEntity: selectedEntity,
      onTableChange: handleBottomLeftTypeChange,
      onClose: () => handleRemoveTable('bottomLeft'),
    });
      if (visibleTables.bottomRight) configs.push({
        type: bottomRightType,
        rows: rowsForType(bottomRightType),
      currentType: bottomRightType,
      selectedEntity: selectedEntity,
      onTableChange: handleBottomRightTypeChange,
      onClose: () => handleRemoveTable('bottomRight'),
    });
    return configs;
  };

  // Helper to render correct table by type
  const renderTableByType = (type: string, props: any) => {
    switch (type) {
      case 'position':
        return <DataTable {...props} currentUser={currentUser} currentType={type} />;
      case 'strategy':
        return <StrategyTable {...props} currentUser={currentUser} currentType={type} positions={positionData} />;
      case 'manual-trade':
        // ManualTradeTable expects position rows; pass `positionData` so it mirrors DataTable
        return <ManualTradeTable {...props} rows={positionData} currentType={type} selectedEntity={selectedEntity} />;
      case 'providers':
        return <ProviderTable {...props} rows={props.rows || []} currentType={type} />;
      case 'execution':
        return <ExecutionTable {...props} currentUser={currentUser} currentType={type} />;
      case 'risk':
        return <RiskTable {...props} currentUser={currentUser} currentType={type} />;
      case 'customer-transactions':
        return <CustomerTransactionsTable {...props} rows={customerTransactions} />;
      case 'internal-transactions':
        return <InternalTransactionsTable {...props} rows={internalTransactions} />;
      default:
        return null;
    }
  };

  if (!mounted || !isAuthenticated) {
    return <div className="h-screen bg-[#0A1929] flex items-center justify-center">
      <div className="text-white">Loading...</div>
    </div>;
  }

  if (!config) {
    return <div className="h-screen bg-[#0A1929] flex items-center justify-center text-white">Loading...</div>;
  }

  return (
    <div className="dashboard-islands h-full flex flex-col overflow-hidden">
      <div className="flex-1 p-1 overflow-hidden">
        <div className="h-full w-full relative" id="dashboard-table-container">
          {/* Horizontal Split Bar between rows (rendered above vertical split bars) */}
          {(visibleTables.topLeft || visibleTables.topRight) && (visibleTables.bottomLeft || visibleTables.bottomRight) && (
            <div
              className="absolute"
              style={{
                top: `calc(${rowHeights[0] * 100}% - 2px)`,
                left: 0,
                width: '100%',
                height: '4px',
                zIndex: 30,
              }}
            >
              <SplitBar direction="horizontal" onDrag={handleRowSplitDrag} />
            </div>
          )}
          {/* Top row */}
          <div
            className="absolute"
            style={{
              top: 0,
              left: 0,
              height: (visibleTables.topLeft || visibleTables.topRight) && (visibleTables.bottomLeft || visibleTables.bottomRight) ? `calc(${rowHeights[0] * 100}%)` : '100%',
              width: '100%',
              display: 'grid',
              gridTemplateColumns: visibleTables.topLeft && visibleTables.topRight ? topColWidths.map(w => `${w * 100}%`).join(' ') : '1fr',
            }}
          >
            {visibleTables.topLeft && (
              <div style={{ overflow: 'hidden' }}>
                <TableContainer>
                  {renderTableByType(topLeftType, {
                    title: '',
                    rows: topLeftType === 'position' ? positionData : topLeftType === 'strategy' ? strategyData : topLeftType === 'execution' ? executionData : riskData,
                    currentType: topLeftType,
                    selectedEntity: selectedEntity,
                    onTableChange: handleTopLeftTypeChange,
                    onClose: () => handleRemoveTable('topLeft'),
                  })}
                </TableContainer>
              </div>
            )}
            {visibleTables.topRight && (
              <div style={{ overflow: 'hidden' }}>
                <TableContainer>
                  {renderTableByType(topRightType, {
                    title: '',
                    rows: topRightType === 'position' ? positionData : topRightType === 'strategy' ? strategyData : topRightType === 'execution' ? executionData : riskData,
                    currentType: topRightType,
                    selectedEntity: selectedEntity,
                    onTableChange: handleTopRightTypeChange,
                    onClose: () => handleRemoveTable('topRight'),
                  })}
                </TableContainer>
              </div>
            )}
          </div>
          {/* Vertical Split Bar for top row */}
          {visibleTables.topLeft && visibleTables.topRight && (
            <div
              className="absolute"
              style={{
                top: 0,
                left: `calc(${topColWidths[0] * 100}% - 2px)`,
                height: (visibleTables.topLeft || visibleTables.topRight) && (visibleTables.bottomLeft || visibleTables.bottomRight) ? `calc(${rowHeights[0] * 100}%)` : '100%',
                width: '4px',
                zIndex: 20,
              }}
            >
              <SplitBar direction="vertical" onDrag={handleTopColSplitDrag} />
            </div>
          )}
          {/* Bottom row */}
          <div
            className="absolute"
            style={{
              top: (visibleTables.topLeft || visibleTables.topRight) && (visibleTables.bottomLeft || visibleTables.bottomRight) ? `calc(${rowHeights[0] * 100}%)` : '0',
              left: 0,
              height: (visibleTables.topLeft || visibleTables.topRight) && (visibleTables.bottomLeft || visibleTables.bottomRight) ? `calc(${rowHeights[1] * 100}%)` : '100%',
              width: '100%',
              display: 'grid',
              gridTemplateColumns: visibleTables.bottomLeft && visibleTables.bottomRight ? bottomColWidths.map(w => `${w * 100}%`).join(' ') : '1fr',
            }}
          >
            {visibleTables.bottomLeft && (
              <div style={{ overflow: 'hidden' }}>
                <TableContainer>
                    {renderTableByType(bottomLeftType, {
                      title: '',
                      rows: rowsForType(bottomLeftType),
                    currentType: bottomLeftType,
                    selectedEntity: selectedEntity,
                    onTableChange: handleBottomLeftTypeChange,
                    onClose: () => handleRemoveTable('bottomLeft'),
                  })}
                </TableContainer>
              </div>
            )}
            {visibleTables.bottomRight && (
              <div style={{ overflow: 'hidden' }}>
                <TableContainer>
                    {renderTableByType(bottomRightType, {
                      title: '',
                      rows: rowsForType(bottomRightType),
                    currentType: bottomRightType,
                    selectedEntity: selectedEntity,
                    onTableChange: handleBottomRightTypeChange,
                    onClose: () => handleRemoveTable('bottomRight'),
                  })}
                </TableContainer>
              </div>
            )}
          </div>
          {/* Vertical Split Bar for bottom row */}
          {visibleTables.bottomLeft && visibleTables.bottomRight && (
            <div
              className="absolute"
              style={{
                top: (visibleTables.topLeft || visibleTables.topRight) && (visibleTables.bottomLeft || visibleTables.bottomRight) ? `calc(${rowHeights[0] * 100}%)` : '0',
                left: `calc(${bottomColWidths[0] * 100}% - 2px)`,
                height: (visibleTables.topLeft || visibleTables.topRight) && (visibleTables.bottomLeft || visibleTables.bottomRight) ? `calc(${rowHeights[1] * 100}%)` : '100%',
                width: '4px',
                zIndex: 20,
              }}
            >
              <SplitBar direction="vertical" onDrag={handleBottomColSplitDrag} />
            </div>
          )}
          {/* Only one table left, fill the whole area */}
          {Object.values(visibleTables).filter(Boolean).length === 1 && (() => {
            const keys: Array<'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'> = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
            const key = keys.find(k => visibleTables[k]);
            if (!key) return null;
            let type: string, rows: any[], currentType: string, onTableChange: (t: string) => void, onClose: () => void;
            if (key === 'topLeft') {
              type = topLeftType;
              rows = topLeftType === 'position' ? positionData : topLeftType === 'strategy' ? strategyData : topLeftType === 'execution' ? executionData : riskData;
              currentType = topLeftType;
              onTableChange = setTopLeftType;
              onClose = () => handleRemoveTable('topLeft');
            } else if (key === 'topRight') {
              type = topRightType;
              rows = topRightType === 'position' ? positionData : topRightType === 'strategy' ? strategyData : topRightType === 'execution' ? executionData : riskData;
              currentType = topRightType;
              onTableChange = setTopRightType;
              onClose = () => handleRemoveTable('topRight');
            } else if (key === 'bottomLeft') {
              type = bottomLeftType;
              rows = bottomLeftType === 'position' ? positionData : bottomLeftType === 'strategy' ? strategyData : bottomLeftType === 'execution' ? executionData : riskData;
              currentType = bottomLeftType;
              onTableChange = setBottomLeftType;
              onClose = () => handleRemoveTable('bottomLeft');
            } else {
              type = bottomRightType;
              rows = bottomRightType === 'position' ? positionData : bottomRightType === 'strategy' ? strategyData : bottomRightType === 'execution' ? executionData : riskData;
              currentType = bottomRightType;
              onTableChange = setBottomRightType;
              onClose = () => handleRemoveTable('bottomRight');
            }
            return (
              <div className="absolute" style={{top: 0, left: 0, height: '100%', width: '100%'}}>
                <TableContainer>
                  {renderTableByType(type, {
                    title: '',
                    rows,
                    currentType,
                    selectedEntity: selectedEntity,
                    onTableChange,
                    onClose,
                  })}
                </TableContainer>
              </div>
            );
          })()}
          {visibleTables.topLeft && visibleTables.topRight && !(visibleTables.bottomLeft || visibleTables.bottomRight) ? (
            <>
              {/* Render two tables in a grid */}
              <div
                className="absolute"
                style={{
                  top: 0,
                  left: 0,
                  height: '100%',
                  width: '100%',
                  display: 'grid',
                  gridTemplateColumns: topColWidths.map(w => `${w * 100}%`).join(' '),
                }}
              >
                <div style={{ overflow: 'hidden' }}>
                  <TableContainer>
                    {renderTableByType(topLeftType, {
                      title: '',
                      rows: rowsForType(topLeftType),
                      currentType: topLeftType,
                      selectedEntity: selectedEntity,
                      onTableChange: handleTopLeftTypeChange,
                      onClose: () => handleRemoveTable('topLeft'),
                    })}
                  </TableContainer>
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <TableContainer>
                    {renderTableByType(topRightType, {
                      title: '',
                      rows: rowsForType(topRightType),
                      currentType: topRightType,
                      selectedEntity: selectedEntity,
                      onTableChange: handleTopRightTypeChange,
                      onClose: () => handleRemoveTable('topRight'),
                    })}
                  </TableContainer>
                </div>
              </div>
              {/* Overlay vertical split bar, only handle is interactive */}
              <div
                className="absolute"
                style={{
                  top: 0,
                  left: `calc(${topColWidths[0] * 100}%)`,
                  transform: 'translateX(-50%)',
                  height: '100%',
                  width: '32px',
                  zIndex: 20,
                  pointerEvents: 'none', // overlay does not block pointer events
                }}
              >
                <div
                  style={{
                    pointerEvents: 'auto', // only the handle is interactive
                    height: '100%',
                    width: '4px', // make handle as narrow as possible
                    margin: '0 auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <SplitBar direction="vertical" onDrag={handleTopColSplitDrag} />
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
