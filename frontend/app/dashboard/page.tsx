"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/auth";
import { statementsApi, gmailApi } from "@/lib/api";
import LogoutButton from "./LogoutButton";

export default function DashboardPage() {
  const router = useRouter();
  
  // State Management
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statements, setStatements] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fetchingGmail, setFetchingGmail] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: "", text: "" });

  /**
   * Status Message Helper
   */
  const showStatus = (text: string, type: "success" | "error") => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg({ text: "", type: "" }), 5000);
  };

  /**
   * Load Initial Data (Session + Statements)
   */
  const loadData = useCallback(async () => {
    try {
      // 1. Check Session - using custom JWT
      const userData = await authApi.getMe();
      
      // If no user is found, redirect to login
      if (!userData?.success || !userData?.data?.user) {
        router.replace("/login");
        return;
      }
      
      setUser(userData.data.user);

      // 2. Fetch Statements
      const statementsData = await statementsApi.getAll();
      if (statementsData?.success) {
        setStatements(statementsData.data || []);
      }
    } catch (err: any) {
      console.error("Dashboard data load error:", err);
      // If unauthorized, redirect to login
      if (err.message.includes("authorized") || err.message.includes("login")) {
        router.replace("/login");
        return;
      }
      showStatus("Failed to load dashboard data.", "error");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Handle Manual PDF/Image Upload
   */
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await statementsApi.upload(file);
      if (result.success) {
        showStatus("Statement uploaded and parsed successfully!", "success");
        loadData(); // Refresh the list
      }
    } catch (err: any) {
      showStatus(err.message || "Upload failed", "error");
    } finally {
      setUploading(false);
      // Reset input value so the same file can be uploaded again if needed
      e.target.value = "";
    }
  };

  /**
   * Handle Gmail Syncing
   */
  const handleGmailFetch = async () => {
    setFetchingGmail(true);
    try {
      const result = await gmailApi.fetchStatements({ maxResults: 5 });
      showStatus(`Successfully synced ${result.count || 0} statements from Gmail`, "success");
      loadData();
    } catch (err: any) {
      showStatus("Gmail sync failed. Check your connection in settings.", "error");
    } finally {
      setFetchingGmail(false);
    }
  };

  /**
   * Handle Record Deletion
   */
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    try {
      const result = await statementsApi.delete(id);
      if (result.success) {
        setStatements(prev => prev.filter(s => s._id !== id));
        showStatus("Statement deleted", "success");
      }
    } catch (err) {
      showStatus("Delete operation failed", "error");
    }
  };

  // 1. Render Loading State
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-500 font-medium">Loading your financial data...</p>
        </div>
      </div>
    );
  }

  // 2. Safety guard: If loading finished but no user exists, don't render UI
  if (!user) return null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header Section */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Dashboard</h1>
            <p className="text-sm text-zinc-500">
              Welcome back, <span className="font-semibold text-zinc-700 dark:text-zinc-300">{user?.name || user?.email}</span>
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button 
              onClick={handleGmailFetch}
              disabled={fetchingGmail}
              className="flex-1 sm:flex-none px-4 py-2 text-sm font-semibold border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all disabled:opacity-50 dark:text-zinc-300"
            >
              {fetchingGmail ? "Syncing..." : "Sync Gmail"}
            </button>
            <LogoutButton />
          </div>
        </header>

        {/* Global Status Message */}
        {statusMsg.text && (
          <div className={`p-4 rounded-xl text-sm font-semibold animate-in fade-in slide-in-from-top-2 duration-300 ${
            statusMsg.type === "success" 
              ? "bg-green-50 text-green-700 border border-green-200" 
              : "bg-red-50 text-red-700 border border-red-200"
          }`}>
            {statusMsg.text}
          </div>
        )}

        {/* Main Controls Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Upload Card */}
          <div className="lg:col-span-1 bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
            </div>
            <h3 className="font-bold dark:text-white mb-2">Manual Upload</h3>
            <p className="text-xs text-zinc-500 mb-6 px-4">Drag and drop your credit card PDF or image statements here.</p>
            
            <input type="file" id="dash-upload" hidden onChange={handleUpload} disabled={uploading} accept=".pdf,image/*" />
            <label 
              htmlFor="dash-upload" 
              className="w-full cursor-pointer py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold text-sm shadow-md shadow-blue-500/20"
            >
              {uploading ? "Processing..." : "Select Statement"}
            </label>
          </div>

          {/* Stats Summary Card */}
          <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800">
            <h3 className="font-bold dark:text-white mb-4">Account Summary</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-1">Total Processed</p>
                <p className="text-3xl font-black text-zinc-900 dark:text-white">{statements.length}</p>
              </div>
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-1">Recent Activity</p>
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mt-2">
                  {statements.length > 0 
                    ? `Last upload: ${new Date(statements[0].createdAt).toLocaleDateString()}` 
                    : "No data found"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* History Table */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
            <h3 className="font-bold text-zinc-900 dark:text-white">Recent Statements</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase text-zinc-400 font-black tracking-widest border-b border-zinc-100 dark:border-zinc-800">
                  <th className="px-6 py-4">File Details</th>
                  <th className="px-6 py-4">Date Parsed</th>
                  <th className="px-6 py-4">Source</th>
                  <th className="px-6 py-4 text-right">Options</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                {statements.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <p className="text-zinc-400 text-sm">No statements parsed yet. Use the upload or sync feature to begin.</p>
                    </td>
                  </tr>
                ) : (
                  statements.map((s) => (
                    <tr key={s._id} className="group hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-all">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg group-hover:bg-white dark:group-hover:bg-zinc-700 transition-colors">
                            <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          </div>
                          <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate max-w-[150px] sm:max-w-xs">{s.fileName}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-zinc-500 font-medium">
                        {new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                          s.source === 'gmail' 
                            ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400' 
                            : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400'
                        }`}>
                          {s.source || 'Manual'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleDelete(s._id)}
                          className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                          title="Delete record"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
