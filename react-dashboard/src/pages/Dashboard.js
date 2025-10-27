import React, { useState, useEffect, useCallback } from 'react';
import { cdrAPI } from '../api';
import StatsCard from '../components/StatsCard';
import CDRTable from '../components/CDRTable';
import Chart from '../components/Chart';
import QRCodeDisplay from '../components/QRCodeDisplay';
import SearchBar from '../components/SearchBar';
import HealthCheck from '../components/HealthCheck';

const Dashboard = () => {
  const [cdrs, setCdrs] = useState([]);
  const [filteredCdrs, setFilteredCdrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Fetch CDRs from API (with verification)
  const fetchCDRs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await cdrAPI.getAllCDRs();
      const records = response.cdrs || [];

      // ✅ Verify each CDR using backend
      const verifiedResults = await Promise.all(
        records.map(async (cdr, i) => {
          try {
            const verifyRes = await cdrAPI.verifyCDR(i, cdr.ipfs_cid);
            return { ...cdr, verified: verifyRes.verified };
          } catch (err) {
            console.warn(`Verification failed for record ${i}:`, err.message);
            return { ...cdr, verified: false };
          }
        })
      );

      setCdrs(verifiedResults);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching CDRs:', err);
      setError('Failed to fetch CDR data. Please check if the backend is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Filter CDRs based on search term
  const filterCDRs = useCallback((searchValue) => {
    if (!searchValue.trim()) {
      setFilteredCdrs(cdrs);
      return;
    }

    const filtered = cdrs.filter(cdr =>
      cdr.caller.toLowerCase().includes(searchValue.toLowerCase()) ||
      cdr.callee.toLowerCase().includes(searchValue.toLowerCase()) ||
      cdr.hash.toLowerCase().includes(searchValue.toLowerCase()) ||
      (cdr.ipfs_cid && cdr.ipfs_cid.toLowerCase().includes(searchValue.toLowerCase()))
    );
    setFilteredCdrs(filtered);
  }, [cdrs]);

  // Handle search
  const handleSearch = (searchValue) => {
    setSearchTerm(searchValue);
    filterCDRs(searchValue);
  };

  // Calculate statistics
  const getStats = () => {
    const total = cdrs.length;
    const verified = cdrs.filter(cdr => cdr.status === 'verified' || cdr.verified).length;
    const withIPFS = cdrs.filter(cdr => cdr.ipfs_cid).length;
    const errors = cdrs.filter(cdr => cdr.status === 'error' || cdr.status === 'mismatch').length;
    return { total, verified, withIPFS, errors };
  };

  const stats = getStats();

  // Auto-refresh every 5 seconds
  useEffect(() => {
    fetchCDRs();
    const interval = setInterval(fetchCDRs, 20000);
    return () => clearInterval(interval);
  }, [fetchCDRs]);

  // Update filtered CDRs when CDRs change
  useEffect(() => {
    filterCDRs(searchTerm);
  }, [cdrs, searchTerm, filterCDRs]);

  // Auto-dismiss error after 8 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                🛰 CDR Blockchain + IPFS Dashboard
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                VoIP Call Detail Records on Blockchain with IPFS Storage
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <HealthCheck />
              <div className="text-sm text-gray-500">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </div>
              <button
                onClick={fetchCDRs}
                disabled={loading}
                className="btn-primary"
              >
                {loading ? (
                  <>
                    <div className="loading-spinner mr-2"></div>
                    Refreshing...
                  </>
                ) : (
                  <>
                    <span className="mr-2">🔄</span>
                    Refresh
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ✅ Updated Error Message Section */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm animate-fade-in">
            <div className="flex items-start space-x-3">
              <div className="text-red-600 text-xl">⚠️</div>
              <div className="flex-1">
                <p className="font-semibold text-red-800">Connection Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <button
                  onClick={fetchCDRs}
                  className="mt-3 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-all"
                >
                  Retry Fetch
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total CDRs"
            value={stats.total}
            icon="📊"
            subtitle="Records on blockchain"
            color="primary"
            loading={loading}
          />
          <StatsCard
            title="Verified"
            value={stats.verified}
            icon="✅"
            subtitle="Hash verified with IPFS"
            color="success"
            loading={loading}
          />
          <StatsCard
            title="With IPFS"
            value={stats.withIPFS}
            icon="🌐"
            subtitle="Records with IPFS backup"
            color="primary"
            loading={loading}
          />
          <StatsCard
            title="Errors"
            value={stats.errors}
            icon="⚠️"
            subtitle="Verification failures"
            color="error"
            loading={loading}
          />
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <SearchBar
            onSearch={handleSearch}
            placeholder="Search by caller, callee, hash, or IPFS CID..."
          />
        </div>

        {/* Charts and QR Code */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <Chart cdrs={filteredCdrs} loading={loading} />
          </div>
          <div>
            <QRCodeDisplay cdrs={cdrs} loading={loading} />
          </div>
        </div>

        {/* CDR Table */}
        <CDRTable
          cdrs={filteredCdrs}
          loading={loading}
          onRefresh={fetchCDRs}
        />
      </main>
    </div>
  );
};

export default Dashboard;
