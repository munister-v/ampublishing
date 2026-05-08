
import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { 
  LayoutDashboard, BookOpen, ShoppingBag, LogOut, 
  Plus, Edit, Trash2, TrendingUp, Users, DollarSign, Search,
  CheckCircle, Clock, Truck, Package, XCircle, ArrowUp, ArrowDown, Save, Loader2, RefreshCw
} from 'lucide-react';
import { OrderStatus } from '../types';

type AdminTab = 'overview' | 'products' | 'orders';

// --- Components ---

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const config: Record<string, string> = {
        delivered: 'bg-green-100 text-green-700 border-green-200',
        shipped: 'bg-blue-100 text-blue-700 border-blue-200',
        processing: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        pending: 'bg-gray-100 text-gray-700 border-gray-200',
        cancelled: 'bg-red-100 text-red-700 border-red-200'
    };
    return (
        <span className={`px-2 py-1 border text-[9px] uppercase font-bold tracking-wider ${config[status.toLowerCase()] || 'bg-gray-100'}`}>
            {status}
        </span>
    );
};

const SimpleLineChart: React.FC<{ data: number[] }> = ({ data }) => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const height = 60;
    const width = 200;
    
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((val - min) / (max - min)) * height;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
            <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} vectorEffect="non-scaling-stroke" />
            <circle cx={(data.length-1)/(data.length-1)*width} cy={height - ((data[data.length-1] - min)/(max-min))*height} r="3" fill="currentColor" />
        </svg>
    );
};

export const AdminPage: React.FC = () => {
  const { books, logout, orders, refreshOrders, updateOrderStatus, updateInventory } = useApp();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Inventory Edit State
  const [editingStock, setEditingStock] = useState<string | null>(null);
  const [tempStockVal, setTempStockVal] = useState<number>(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const filteredBooks = books.filter(b => b.title.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredOrders = orders.filter(o => 
      o.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      o.customer.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats Logic
  const totalRevenue = orders.filter(o => o.paymentStatus === 'paid').reduce((acc, o) => acc + o.total, 0);
  const pendingOrders = orders.filter(o => o.status === 'processing' || o.status === 'pending').length;

  const handleRefresh = async () => {
      setIsRefreshing(true);
      await refreshOrders();
      setTimeout(() => setIsRefreshing(false), 800); // Minimum spin time for visual feedback
  };

  const handleStockSave = async (bookId: string) => {
      setActionLoading(bookId);
      await updateInventory(bookId, tempStockVal);
      setActionLoading(null);
      setEditingStock(null);
  };

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
      setActionLoading(orderId);
      await updateOrderStatus(orderId, status);
      setActionLoading(null);
  };

  return (
    <div className="min-h-screen bg-[#F4F4F0] pt-[80px] flex flex-col md:flex-row font-sans text-primary">
      
      {/* SIDEBAR */}
      <aside className="w-full md:w-72 bg-primary text-white flex-shrink-0 md:min-h-[calc(100vh-80px)] shadow-xl z-20">
        <div className="p-8 border-b border-white/10">
            <h2 className="font-serif text-3xl">AM Admin</h2>
            <p className="text-[10px] font-mono opacity-50 uppercase tracking-widest mt-1">Enterprise Resource Planning</p>
        </div>
        
        <nav className="p-6 space-y-3">
            <button 
                onClick={() => setActiveTab('overview')}
                className={`w-full flex items-center gap-4 px-4 py-4 text-xs uppercase font-bold tracking-widest transition-all ${activeTab === 'overview' ? 'bg-accent text-primary translate-x-2 shadow-lg' : 'hover:bg-white/10 text-gray-300'}`}
            >
                <LayoutDashboard size={18} /> Dashboard
            </button>
            <button 
                onClick={() => setActiveTab('orders')}
                className={`w-full flex items-center gap-4 px-4 py-4 text-xs uppercase font-bold tracking-widest transition-all ${activeTab === 'orders' ? 'bg-accent text-primary translate-x-2 shadow-lg' : 'hover:bg-white/10 text-gray-300'}`}
            >
                <ShoppingBag size={18} /> Orders
                {pendingOrders > 0 && <span className="ml-auto bg-red-500 text-white text-[9px] px-2 py-0.5 rounded-full">{pendingOrders}</span>}
            </button>
            <button 
                onClick={() => setActiveTab('products')}
                className={`w-full flex items-center gap-4 px-4 py-4 text-xs uppercase font-bold tracking-widest transition-all ${activeTab === 'products' ? 'bg-accent text-primary translate-x-2 shadow-lg' : 'hover:bg-white/10 text-gray-300'}`}
            >
                <BookOpen size={18} /> Inventory
            </button>
        </nav>

        <div className="p-6 mt-auto border-t border-white/10">
            <button 
                onClick={logout}
                className="w-full flex items-center gap-3 px-4 py-3 text-xs uppercase tracking-widest text-red-300 hover:bg-red-900/20 hover:text-red-100 transition-colors border border-red-900/30"
            >
                <LogOut size={16} /> Secure Logout
            </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-6 md:p-12 overflow-y-auto bg-[#F4F4F0] relative h-[calc(100vh-80px)]">
         
         {/* Background Grid */}
         <div className="absolute inset-0 pointer-events-none opacity-[0.03]" 
              style={{ backgroundImage: 'linear-gradient(#040F1E 1px, transparent 1px), linear-gradient(90deg, #040F1E 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
         </div>

         {/* --- GLOBAL ACTION HEADER --- */}
         <div className="flex justify-between items-end mb-8 relative z-10">
             <div>
                <h1 className="text-4xl font-serif text-primary capitalize">{activeTab}</h1>
                <p className="font-mono text-xs uppercase tracking-widest text-gray-500 mt-1">
                    {activeTab === 'overview' ? 'System Status: Operational' : activeTab === 'orders' ? 'Manage Customer Orders' : 'Stock & Pricing'}
                </p>
             </div>
             <button 
                onClick={handleRefresh}
                className={`p-3 bg-white border border-primary text-primary hover:bg-primary hover:text-white transition-all shadow-sm ${isRefreshing ? 'animate-spin' : ''}`}
                title="Refresh Data"
             >
                <RefreshCw size={18} />
             </button>
         </div>

         {/* --- OVERVIEW TAB --- */}
         {activeTab === 'overview' && (
            <div className="animate-fade-in relative z-10">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                    <div className="bg-white p-6 border border-primary/10 shadow-[8px_8px_0px_0px_rgba(4,15,30,0.05)] hover:-translate-y-1 transition-transform">
                        <div className="flex justify-between items-start mb-4">
                            <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Net Revenue</span>
                            <TrendingUp size={16} className="text-green-600" />
                        </div>
                        <span className="text-3xl font-serif block mb-2">€{totalRevenue.toLocaleString()}</span>
                        <div className="h-10 text-green-500">
                            <SimpleLineChart data={[10, 25, 18, 30, 45, 35, 50]} />
                        </div>
                    </div>

                    <div className="bg-white p-6 border border-primary/10 shadow-[8px_8px_0px_0px_rgba(4,15,30,0.05)] hover:-translate-y-1 transition-transform">
                        <div className="flex justify-between items-start mb-4">
                            <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Total Orders</span>
                            <Package size={16} className="text-blue-600" />
                        </div>
                        <span className="text-3xl font-serif block mb-2">{orders.length}</span>
                        <span className="text-xs text-green-600 font-mono flex items-center gap-1"><ArrowUp size={10}/> 12% vs last week</span>
                    </div>

                    <div className="bg-white p-6 border border-primary/10 shadow-[8px_8px_0px_0px_rgba(4,15,30,0.05)] hover:-translate-y-1 transition-transform">
                        <div className="flex justify-between items-start mb-4">
                            <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Avg. Order Value</span>
                            <DollarSign size={16} className="text-accent" />
                        </div>
                        <span className="text-3xl font-serif block mb-2">€{(totalRevenue / (orders.length || 1)).toFixed(2)}</span>
                        <span className="text-xs text-gray-400 font-mono">Per customer</span>
                    </div>

                    <div className="bg-white p-6 border border-primary/10 shadow-[8px_8px_0px_0px_rgba(4,15,30,0.05)] hover:-translate-y-1 transition-transform">
                        <div className="flex justify-between items-start mb-4">
                            <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Active SKUs</span>
                            <BookOpen size={16} className="text-purple-600" />
                        </div>
                        <span className="text-3xl font-serif block mb-2">{books.length}</span>
                        <span className="text-xs text-red-500 font-mono flex items-center gap-1">2 items low stock</span>
                    </div>
                </div>

                {/* Recent Activity Table */}
                <div className="bg-white border border-primary">
                    <div className="p-6 border-b border-primary bg-gray-50 flex justify-between items-center">
                        <h3 className="font-bold uppercase text-xs tracking-widest">Recent System Events</h3>
                        <button className="text-xs underline hover:text-accent">View All Logs</button>
                    </div>
                    <div className="p-0">
                        {orders.slice(0, 5).map(order => (
                            <div key={order.id} className="flex items-center justify-between p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-full ${order.status === 'delivered' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                                        {order.status === 'delivered' ? <CheckCircle size={14}/> : <Clock size={14}/>}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold">Order {order.id} updated</p>
                                        <p className="text-xs text-gray-500 font-mono">{order.customer.email}</p>
                                    </div>
                                </div>
                                <span className="text-xs font-mono text-gray-400">{new Date(order.date).toLocaleTimeString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
         )}

         {/* --- ORDERS TAB --- */}
         {activeTab === 'orders' && (
             <div className="animate-fade-in relative z-10 h-full flex flex-col">
                <div className="bg-white border border-primary shadow-sm flex-1 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-primary flex items-center gap-4 bg-gray-50">
                        <Search size={18} className="text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Search by Order ID or Email..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1 outline-none font-mono text-sm uppercase bg-transparent"
                        />
                    </div>
                    
                    <div className="overflow-auto flex-1">
                        <table className="w-full text-left">
                            <thead className="bg-primary text-white font-mono text-[10px] uppercase tracking-widest sticky top-0 z-20">
                                <tr>
                                    <th className="p-4">Order ID</th>
                                    <th className="p-4">Date</th>
                                    <th className="p-4">Customer</th>
                                    <th className="p-4">Items</th>
                                    <th className="p-4">Total</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="font-mono text-sm">
                                {filteredOrders.map(order => (
                                    <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                        <td className="p-4 font-bold text-primary">{order.id}</td>
                                        <td className="p-4 text-gray-500">{new Date(order.date).toLocaleDateString()}</td>
                                        <td className="p-4">
                                            <div className="font-bold text-xs">{order.customer.name}</div>
                                            <div className="text-[10px] text-gray-400">{order.customer.location}</div>
                                        </td>
                                        <td className="p-4 text-xs text-gray-600">
                                            {order.items.map(i => (
                                                <div key={i.variantId} className="truncate max-w-[150px]">{i.quantity}x {i.bookTitle}</div>
                                            ))}
                                        </td>
                                        <td className="p-4 font-bold">{order.total.toFixed(2)} {order.currency}</td>
                                        <td className="p-4">
                                            <StatusBadge status={order.status} />
                                        </td>
                                        <td className="p-4 text-right">
                                            {actionLoading === order.id ? (
                                                <Loader2 className="animate-spin ml-auto text-primary" size={16} />
                                            ) : (
                                                <select 
                                                    value={order.status}
                                                    onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                                                    className="bg-white border border-gray-300 text-xs p-1 outline-none focus:border-primary cursor-pointer hover:bg-gray-100"
                                                >
                                                    <option value="pending">Pending</option>
                                                    <option value="processing">Processing</option>
                                                    <option value="shipped">Shipped</option>
                                                    <option value="delivered">Delivered</option>
                                                    <option value="cancelled">Cancelled</option>
                                                </select>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
             </div>
         )}

         {/* --- INVENTORY TAB --- */}
         {activeTab === 'products' && (
             <div className="animate-fade-in relative z-10 h-full flex flex-col">
                
                <div className="flex justify-end mb-4">
                    <button className="bg-primary text-white px-6 py-3 uppercase text-xs font-bold tracking-widest hover:bg-accent transition-colors flex items-center gap-2 shadow-lg">
                        <Plus size={16} /> Add SKU
                    </button>
                </div>

                <div className="bg-white border border-primary shadow-sm flex-1 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-primary flex items-center gap-4 bg-gray-50">
                        <Search size={18} className="text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Filter inventory..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1 outline-none font-mono text-sm uppercase bg-transparent"
                        />
                    </div>
                    
                    <div className="overflow-auto flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-100 font-mono text-[10px] uppercase tracking-widest text-gray-500 sticky top-0 z-20 border-b border-gray-200">
                                <tr>
                                    <th className="p-4 bg-gray-100">Image</th>
                                    <th className="p-4 bg-gray-100">Product Details</th>
                                    <th className="p-4 bg-gray-100">Price</th>
                                    <th className="p-4 bg-gray-100">Stock Level</th>
                                    <th className="p-4 bg-gray-100 text-right">Quick Actions</th>
                                </tr>
                            </thead>
                            <tbody className="font-mono text-sm">
                                {filteredBooks.map(book => (
                                    <tr key={book.id} className="hover:bg-gray-50 group transition-colors">
                                        <td className="p-4 border-b border-gray-100 w-20">
                                            <div className="w-10 h-14 border border-gray-200 overflow-hidden shadow-sm">
                                                <img src={book.coverUrl} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" />
                                            </div>
                                        </td>
                                        <td className="p-4 border-b border-gray-100">
                                            <div className="font-serif text-lg leading-none mb-1 text-primary">{book.title}</div>
                                            <span className="text-[10px] text-gray-400 block">ID: {book.id}</span>
                                            <span className="text-[10px] text-accent uppercase font-bold">{book.type.replace('_', ' ')}</span>
                                        </td>
                                        <td className="p-4 border-b border-gray-100 font-bold">
                                            {book.price.toFixed(2)}
                                        </td>
                                        <td className="p-4 border-b border-gray-100">
                                            {editingStock === book.id ? (
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="number" 
                                                        value={tempStockVal}
                                                        onChange={(e) => setTempStockVal(Math.max(0, parseInt(e.target.value) || 0))}
                                                        className="w-20 border border-primary p-1 text-center font-bold"
                                                        autoFocus
                                                    />
                                                    <button onClick={() => handleStockSave(book.id)} className="p-1 bg-green-500 text-white hover:bg-green-600">
                                                        {actionLoading === book.id ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle size={14}/>}
                                                    </button>
                                                    <button onClick={() => setEditingStock(null)} className="p-1 bg-gray-300 text-gray-700 hover:bg-gray-400"><XCircle size={14}/></button>
                                                </div>
                                            ) : (
                                                <span 
                                                    onClick={() => { setEditingStock(book.id); setTempStockVal(book.stock); }}
                                                    className={`cursor-pointer px-3 py-1 text-[10px] rounded-full border border-transparent hover:border-gray-300 transition-all ${book.stock > 10 ? 'bg-green-100 text-green-700' : book.stock > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}
                                                >
                                                    {book.stock} units
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 border-b border-gray-100 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="p-2 hover:bg-primary hover:text-white border border-gray-200 transition-colors" title="Edit Details"><Edit size={14}/></button>
                                                <button className="p-2 hover:bg-red-500 hover:text-white border border-gray-200 transition-colors" title="Delete SKU"><Trash2 size={14}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
             </div>
         )}

      </main>
    </div>
  );
};
