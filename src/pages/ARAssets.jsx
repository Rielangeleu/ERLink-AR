import { useState } from 'react';
import { Box, Upload, Eye, Trash2 } from 'lucide-react';

const mockAssets = [
    { id: 1, name: 'Patient_CodeBlue', type: 'GLB Model', size: '4.2 MB', scenario: 'SCN_001', uploadedBy: 'Admin', date: '2026-04-01' },
    { id: 2, name: 'Patient_Hemorrhage', type: 'GLB Model', size: '3.8 MB', scenario: 'SCN_002A', uploadedBy: 'Admin', date: '2026-04-01' },
    { id: 3, name: 'Patient_Fracture', type: 'GLB Model', size: '3.5 MB', scenario: 'SCN_002B', uploadedBy: 'Admin', date: '2026-04-01' },
];

export default function ARAssets() {
    const [assets, setAssets] = useState(mockAssets);

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">AR Assets</h1>
                    <p className="text-gray-500">3D patient models and AR resources</p>
                </div>
                <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700">
                    <Upload size={16} />
                    Upload Asset
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            {['Asset Name', 'Type', 'Size', 'Scenario', 'Uploaded By', 'Date', 'Actions'].map(h => (
                                <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {assets.map(asset => (
                            <tr key={asset.id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                                            <Box size={18} className="text-blue-600" />
                                        </div>
                                        <span className="text-sm font-medium text-gray-900">
                                            {asset.name}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-lg font-medium">
                                        {asset.type}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">{asset.size}</td>
                                <td className="px-6 py-4 text-sm text-gray-600">{asset.scenario}</td>
                                <td className="px-6 py-4 text-sm text-gray-600">{asset.uploadedBy}</td>
                                <td className="px-6 py-4 text-sm text-gray-500">{asset.date}</td>
                                <td className="px-6 py-4">
                                    <button className="text-blue-600 hover:text-blue-700 p-1">
                                        <Eye size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
