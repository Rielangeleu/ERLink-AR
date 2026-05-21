import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import {
    collection, getDocs, doc, addDoc, updateDoc, deleteDoc,
    serverTimestamp, query, orderBy, writeBatch
} from 'firebase/firestore';
import {
    CheckCircle, XCircle, Clock, Users, PlusCircle,
    Edit3, X, Loader2, Info, Activity, ShieldAlert, Plus, Trash2, ShieldQuestion, HeartPulse, ClipboardList, GripVertical, Construction
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// FUTURE DEVELOPMENT FLAG - Set to true when ready for production
const IS_SCENARIO_CREATION_ENABLED = false; // Change to true to enable scenario creation

// Sortable Scenario Card Component
function SortableScenarioCard({ scenario, index, onEdit, onToggle, onDelete, difficultyColor, getPatientCount }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: scenario.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            className={`bg-white rounded-2xl border p-5 transition-all shadow-sm flex flex-col justify-between border-gray-200 ${!scenario.isActive && 'opacity-60 bg-gray-50/50'} ${isDragging ? 'shadow-2xl rotate-1' : ''}`}
        >
            <div>
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <button
                            {...listeners}
                            className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded-lg transition-colors touch-none"
                            aria-label="Drag to reorder"
                        >
                            <GripVertical size={16} className="text-gray-400" />
                        </button>
                        <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${difficultyColor[scenario.difficulty]}`}>
                            {scenario.difficulty}
                        </span>
                        <span className="text-xs text-gray-400 font-mono font-bold">{scenario.scenarioID}</span>
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                            Order: {scenario.orderIndex !== undefined ? scenario.orderIndex : index + 1}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => onEdit(scenario)}
                            className="p-1.5 hover:bg-gray-100 text-gray-500 hover:text-gray-800 rounded-lg transition-colors border border-gray-100 bg-white"
                            title="Edit Scenario"
                        >
                            <Edit3 size={14} />
                        </button>
                        <button
                            onClick={() => onDelete(scenario.id, scenario.scenarioTitle)}
                            className="p-1.5 hover:bg-red-50 text-red-500 hover:text-red-700 rounded-lg transition-colors border border-gray-100 bg-white"
                            title="Delete Scenario"
                        >
                            <Trash2 size={14} />
                        </button>
                        <button
                            onClick={() => onToggle(scenario.id, scenario.isActive)}
                            className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors ${scenario.isActive ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        >
                            {scenario.isActive ? 'Active' : 'Disabled'}
                        </button>
                    </div>
                </div>

                <h3 className="font-bold text-gray-900 mb-1 text-base">{scenario.scenarioTitle}</h3>
                <p className="text-xs text-gray-500 mb-4 leading-relaxed line-clamp-2">{scenario.scenarioDescription}</p>
            </div>

            <div className="flex flex-wrap items-center gap-y-2 justify-between border-t border-gray-100 pt-3 mt-2 text-xs text-gray-400">
                <span className="flex items-center gap-1 font-medium"><Clock size={12} />{Math.floor(scenario.timeLimitSeconds / 60)} min limit</span>
                <span className="flex items-center gap-1 font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                    <Users size={12} />{getPatientCount(scenario)} Patient{getPatientCount(scenario) > 1 ? 's' : ''}
                </span>
                {scenario.isMultiPatient && (
                    <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">Priority order check active</span>
                )}
            </div>
        </div>
    );
}

export default function Scenarios() {
    const { profile } = useAuth();
    const [scenarios, setScenarios] = useState([]);
    const [availableAssets, setAvailableAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [reordering, setReordering] = useState(false);
    const [assetsLoading, setAssetsLoading] = useState(true);
    const [assetsError, setAssetsError] = useState(null);

    const [difficultyFilter, setDifficultyFilter] = useState('All');

    const [showModal, setShowModal] = useState(false);
    const [editingScenarioId, setEditingScenarioId] = useState(null);
    const [activeTab, setActiveTab] = useState('scenario-identity');
    const [activePatientIndex, setActivePatientIndex] = useState(0);
    const [patientSubTab, setPatientSubTab] = useState('profile');

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const getBlankPatientTemplate = () => ({
        patientAge: '~40s',
        patientGender: 'Male',
        patientPresentation: '',
        vitalSigns: ['', '', ''],
        downloadURL: '',
        correctTriageCategory: 'Immediate',
        rpmAssessment: {
            respirationQuestion: 'Assess Respiration rate:',
            respirationOptions: ['Normal (<30/min)', 'Rapid (>30/min)', 'Absent/Agonal'],
            correctRespirationIndex: 0,
            respirationFeedback: '',
            perfusionQuestion: 'Assess Perfusion / Capillary Refill:',
            perfusionOptions: ['Normal (<2s)', 'Delayed (>2s)', 'Absent Pulse'],
            correctPerfusionIndex: 0,
            perfusionFeedback: '',
            mentalStatusQuestion: 'Assess Mental Status / Commands:',
            mentalStatusOptions: ['Obeys Commands', 'Fails Commands / Confused', 'Unresponsive'],
            correctMentalStatusIndex: 0,
            mentalStatusFeedback: ''
        },
        ehrActions: [
            { actionName: '', actionDescription: '', isCorrectAction: true },
            { actionName: '', actionDescription: '', isCorrectAction: false },
            { actionName: '', actionDescription: '', isCorrectAction: false }
        ],
        clinicalExplanation: ''
    });

    const initialFormState = {
        scenarioID: '',
        scenarioTitle: '',
        scenarioDescription: '',
        difficulty: 'Easy',
        emergencyCode: 'None',
        timeLimitSeconds: 180,
        isMultiPatient: false,
        correctPriorityOrder: 0,
        patients: [getBlankPatientTemplate()],
        isActive: true,
        orderIndex: 0
    };

    const [form, setForm] = useState(initialFormState);
    const isITAdmin = profile?.role === 'it_admin';

    useEffect(() => {
        loadPageData();
    }, []);

    async function loadPageData() {
        setLoading(true);
        try {
            // Load scenarios - try orderBy with error handling for missing index
            let scenariosData = [];
            try {
                const scSnap = await getDocs(query(collection(db, 'scenarios'), orderBy('orderIndex', 'asc'), orderBy('uploadedAt', 'asc')));
                scenariosData = scSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (orderError) {
                console.warn('Order query failed, falling back to simple query:', orderError);
                const scSnap = await getDocs(collection(db, 'scenarios'));
                scenariosData = scSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                scenariosData.sort((a, b) => (a.orderIndex || 999) - (b.orderIndex || 999));
            }

            console.log('Loaded scenarios:', scenariosData.length, scenariosData);

            const needsUpdate = scenariosData.some(s => s.orderIndex === undefined);
            if (needsUpdate && scenariosData.length > 0) {
                await reorderScenarios(scenariosData);
            } else {
                setScenarios(scenariosData);
            }

            await loadAssets();
        } catch (e) {
            console.error('Data loading failure:', e);
        } finally {
            setLoading(false);
        }
    }

    async function loadAssets() {
        setAssetsLoading(true);
        setAssetsError(null);
        try {
            const astSnap = await getDocs(collection(db, 'ar_assets'));
            const assetsData = astSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            console.log('Loaded assets:', assetsData);
            const validAssets = assetsData.filter(asset => asset.downloadURL && asset.isActive !== false);
            setAvailableAssets(validAssets);
            if (validAssets.length === 0) {
                console.warn('No valid assets found in ar_assets collection');
                setAssetsError('No 3D models uploaded yet. Go to AR Assets page to upload GLB files.');
            }
        } catch (error) {
            console.error('Failed to load assets:', error);
            setAssetsError('Failed to load 3D assets. Please check your Firebase connection.');
        } finally {
            setAssetsLoading(false);
        }
    }

    async function reorderScenarios(reorderedScenarios) {
        setReordering(true);
        try {
            const batch = writeBatch(db);
            reorderedScenarios.forEach((scenario, index) => {
                const scenarioRef = doc(db, 'scenarios', scenario.id);
                batch.update(scenarioRef, { orderIndex: index });
            });
            await batch.commit();
            const updatedScenarios = reorderedScenarios.map((scenario, index) => ({
                ...scenario,
                orderIndex: index
            }));
            setScenarios(updatedScenarios);
            console.log('Scenarios reordered successfully!');
        } catch (error) {
            console.error('Failed to reorder scenarios:', error);
            alert('Failed to save new order. Please try again.');
            await loadPageData();
        } finally {
            setReordering(false);
        }
    }

    async function handleDragEnd(event) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const filtered = scenarios.filter(s => difficultyFilter === 'All' || s.difficulty === difficultyFilter);
        const oldIndex = filtered.findIndex(s => s.id === active.id);
        const newIndex = filtered.findIndex(s => s.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;
        const reorderedFiltered = arrayMove(filtered, oldIndex, newIndex);
        const otherScenarios = scenarios.filter(s => difficultyFilter !== 'All' && s.difficulty !== difficultyFilter);
        const allReordered = [...otherScenarios, ...reorderedFiltered];
        await reorderScenarios(allReordered);
    }

    const getPatientCount = (scenario) => {
        return scenario.patients?.length || 1;
    };

    async function toggleScenario(id, currentStatus) {
        try {
            await updateDoc(doc(db, 'scenarios', id), {
                isActive: !currentStatus,
                updatedAt: serverTimestamp()
            });
            setScenarios(prev => prev.map(s => s.id === id ? { ...s, isActive: !currentStatus } : s));
        } catch (e) {
            alert('Status toggle failed: ' + e.message);
        }
    }

    async function deleteScenario(id, title) {
        if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
            return;
        }
        try {
            await deleteDoc(doc(db, 'scenarios', id));
            setScenarios(prev => prev.filter(s => s.id !== id));
            console.log(`Deleted scenario: ${title}`);
        } catch (e) {
            console.error('Delete failed:', e);
            alert('Failed to delete scenario: ' + e.message);
        }
    }

    function openCreateModal() {
        if (!IS_SCENARIO_CREATION_ENABLED) {
            alert('Scenario creation is currently disabled. This feature is under development.');
            return;
        }
        setEditingScenarioId(null);
        const maxOrder = scenarios.length > 0 ? Math.max(...scenarios.map(s => s.orderIndex ?? 0)) : -1;
        setForm({ ...initialFormState, orderIndex: maxOrder + 1 });
        setActiveTab('scenario-identity');
        setActivePatientIndex(0);
        setPatientSubTab('profile');
        setShowModal(true);
        loadAssets();
    }

    function openEditModal(scenario) {
        setEditingScenarioId(scenario.id);
        setForm({ ...initialFormState, ...scenario });
        setActiveTab('scenario-identity');
        setActivePatientIndex(0);
        setPatientSubTab('profile');
        setShowModal(true);
        loadAssets();
    }

    const addPatientToForm = () => {
        setForm({
            ...form,
            isMultiPatient: true,
            patients: [...form.patients, getBlankPatientTemplate()]
        });
        setActivePatientIndex(form.patients.length);
    };

    const removePatientFromForm = (indexToRemove) => {
        if (form.patients.length <= 1) return;
        const filteredPatients = form.patients.filter((_, idx) => idx !== indexToRemove);
        setForm({
            ...form,
            isMultiPatient: filteredPatients.length > 1,
            patients: filteredPatients
        });
        setActivePatientIndex(0);
    };

    const updatePatientField = (field, value) => {
        const updatedPatients = [...form.patients];
        updatedPatients[activePatientIndex] = {
            ...updatedPatients[activePatientIndex],
            [field]: value
        };
        setForm({ ...form, patients: updatedPatients });
    };

    async function handleFormSubmit(e) {
        e.preventDefault();
        setSubmitting(true);

        const verifiedPatients = form.patients.map(patient => {
            const compiledVitals = [...patient.vitalSigns];
            if (!compiledVitals[0]) compiledVitals[0] = "Assessed Respiration";
            if (!compiledVitals[1]) compiledVitals[1] = "Assessed Perfusion";
            if (!compiledVitals[2]) compiledVitals[2] = "Assessed Mental Status";
            return { ...patient, vitalSigns: compiledVitals };
        });

        const maxOrder = scenarios.length > 0 ? Math.max(...scenarios.map(s => s.orderIndex ?? 0)) : -1;

        const payload = {
            ...form,
            scenarioID: form.scenarioID || `SCN_${Date.now().toString().slice(-4)}`,
            timeLimitSeconds: Number(form.timeLimitSeconds),
            isMultiPatient: form.patients.length > 1,
            patients: verifiedPatients,
            updatedAt: serverTimestamp(),
            orderIndex: form.orderIndex ?? maxOrder + 1
        };

        try {
            if (editingScenarioId) {
                await updateDoc(doc(db, 'scenarios', editingScenarioId), payload);
                console.log('Scenario updated successfully!');
            } else {
                payload.uploadedAt = serverTimestamp();
                payload.createdBy = profile?.email || 'Instructor';
                await addDoc(collection(db, 'scenarios'), payload);
                console.log('Scenario created successfully!');
            }
            setShowModal(false);
            await loadPageData();
        } catch (e) {
            console.error('Save error:', e);
            alert('Saving failure error: ' + e.message);
        } finally {
            setSubmitting(false);
        }
    }

    const filteredScenarios = scenarios.filter(s => difficultyFilter === 'All' || s.difficulty === difficultyFilter);

    const difficultyColor = {
        Easy: 'bg-green-100 text-green-700 border-green-200',
        Medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        Hard: 'bg-red-100 text-red-700 border-red-200',
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">Scenarios Workshop</h1>
                    <p className="text-gray-500">Group and build modular clinical scenarios with full multi-patient START protocol tracking.</p>
                    {reordering && (
                        <p className="text-xs text-purple-600 mt-1 animate-pulse">Saving new order...</p>
                    )}
                </div>

                {/* Yellow Badge - Shows for ALL users (Admin AND Instructor) */}
                <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 px-4 py-2 rounded-xl">
                    <Construction size={18} className="text-yellow-600" />
                    <span className="text-sm text-yellow-700 font-medium">Under Development</span>
                </div>
            </div>

            {/* Future Development Notice */}
            {!IS_SCENARIO_CREATION_ENABLED && isITAdmin && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex gap-3 items-start">
                    <Info size={20} className="text-blue-500 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-blue-800">🚧 Scenario Builder Coming Soon</p>
                        <p className="text-sm text-blue-700 mt-1">
                            The scenario creation feature is currently under development. You can view existing scenarios below, but creating new ones will be available in a future update.
                            <br />
                            <span className="text-xs text-blue-600 mt-1 block">
                                To enable this feature, set <code className="bg-blue-100 px-1 rounded">IS_SCENARIO_CREATION_ENABLED = true</code> in Scenarios.jsx
                            </span>
                        </p>
                    </div>
                </div>
            )}

            <div className="flex gap-2 border-b border-gray-200 pb-1.5 overflow-x-auto text-sm">
                {['All', 'Easy', 'Medium', 'Hard'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setDifficultyFilter(tab)}
                        className={`px-4 py-2 font-bold transition-all rounded-xl border ${difficultyFilter === tab
                            ? 'bg-purple-600 border-purple-600 text-white shadow-sm'
                            : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                            }`}
                    >
                        {tab} Tasks ({tab === 'All' ? scenarios.length : scenarios.filter(s => s.difficulty === tab).length})
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="py-24 text-center text-gray-400 font-medium">
                    <Loader2 className="animate-spin mx-auto mb-2" size={32} />
                    Syncing workspace configurations...
                </div>
            ) : filteredScenarios.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center text-gray-400">
                    <Activity className="mx-auto mb-3 opacity-20" size={48} />
                    No custom targets active under the "{difficultyFilter}" grouping tag segment.
                </div>
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={filteredScenarios.map(s => s.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {filteredScenarios.map((scenario, idx) => (
                                <SortableScenarioCard
                                    key={scenario.id}
                                    scenario={scenario}
                                    index={idx}
                                    onEdit={openEditModal}
                                    onToggle={toggleScenario}
                                    onDelete={deleteScenario}
                                    difficultyColor={difficultyColor}
                                    getPatientCount={getPatientCount}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <form onSubmit={handleFormSubmit} className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-gray-100 max-h-[92vh] flex flex-col animate-fade-in text-sm text-gray-700">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-3xl">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">{editingScenarioId ? 'Modify Scenario Suite' : 'Construct New Simulation Suite'}</h2>
                                <p className="text-xs text-gray-500 mt-0.5">Define multi-patient array clusters matching structural parameters loaded inside Unity workspace engines.</p>
                            </div>
                            <button type="button" onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={20} /></button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-gray-100 bg-gray-50/30 px-6 space-x-2 text-xs font-bold uppercase tracking-wider">
                            <button
                                type="button"
                                onClick={() => setActiveTab('scenario-identity')}
                                className={`px-4 py-3 border-b-2 transition-all ${activeTab === 'scenario-identity' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-400'}`}
                            >
                                1. Global Scenario Metadata
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('patients-list')}
                                className={`px-4 py-3 border-b-2 transition-all flex items-center gap-1.5 ${activeTab === 'patients-list' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-400'}`}
                            >
                                2. Configure Patient Array Components ({form.patients.length})
                            </button>
                        </div>

                        {/* Tab 1: Scenario Identity */}
                        {activeTab === 'scenario-identity' && (
                            <div className="p-6 overflow-y-auto flex-1 bg-white">
                                <div className="space-y-4 animate-fade max-w-2xl">
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Scenario ID *</label>
                                            <input required type="text" placeholder="SCN_002" value={form.scenarioID} onChange={e => setForm({ ...form, scenarioID: e.target.value.toUpperCase() })} className="w-full h-10 border border-gray-200 rounded-xl px-3 outline-none font-mono font-bold text-purple-700 bg-gray-50 focus:bg-white transition-colors" />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Scenario Module Title *</label>
                                            <input required type="text" placeholder="e.g., Multiple Trauma Incident Site A" value={form.scenarioTitle} onChange={e => setForm({ ...form, scenarioTitle: e.target.value })} className="w-full h-10 border border-gray-200 rounded-xl px-3 outline-none bg-gray-50 focus:bg-white transition-colors font-semibold" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Global Case Description briefing</label>
                                        <textarea required rows={3} placeholder="Provide tactical briefing or environment criteria overview parameters..." value={form.scenarioDescription} onChange={e => setForm({ ...form, scenarioDescription: e.target.value })} className="w-full border border-gray-200 rounded-xl p-3 outline-none text-gray-600 leading-relaxed bg-gray-50 focus:bg-white transition-colors" />
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Difficulty Allocation</label>
                                            <select value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })} className="w-full h-10 border border-gray-200 rounded-xl px-2 outline-none font-bold text-gray-700 bg-gray-50">
                                                <option value="Easy">Easy (1 Patient)</option>
                                                <option value="Medium">Medium (2 Patients)</option>
                                                <option value="Hard">Hard (Multi-Patient Cluster)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Emergency Hospital Code</label>
                                            <select value={form.emergencyCode} onChange={e => setForm({ ...form, emergencyCode: e.target.value })} className="w-full h-10 border border-gray-200 rounded-xl px-2 outline-none font-bold text-gray-700 bg-gray-50">
                                                <option value="None">None (Standard Mode)</option>
                                                <option value="CodeBlue">Code Blue (Cardiac Arrest)</option>
                                                <option value="CodeRed">Code Red (Fire Emergency)</option>
                                                <option value="CodeOrange">Code Orange (Hazmat Spill)</option>
                                                <option value="CodeSilver">Code Silver (Active Threat)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Total Timer Phase Seconds</label>
                                            <input type="number" value={form.timeLimitSeconds} onChange={e => setForm({ ...form, timeLimitSeconds: e.target.value })} className="w-full h-10 border border-gray-200 rounded-xl px-3 outline-none font-bold bg-gray-50" />
                                        </div>
                                    </div>

                                    <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl">
                                        <label className="block text-[10px] font-bold text-gray-600 uppercase mb-2">Display Order (drag to reorder on main page)</label>
                                        <input type="number" value={form.orderIndex} onChange={e => setForm({ ...form, orderIndex: Number(e.target.value) })} className="w-24 h-9 border border-gray-200 rounded-lg px-3 font-bold" />
                                        <p className="text-[10px] text-gray-400 mt-1">Lower numbers appear first. Drag cards to reorder automatically.</p>
                                    </div>

                                    {form.patients.length > 1 && (
                                        <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center justify-between">
                                            <div className="flex gap-2 items-start text-xs text-amber-800">
                                                <Info size={16} className="mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="font-bold">Multi-Patient Tracking Array Active!</p>
                                                    <p className="text-gray-500 mt-0.5">Unity session loader will sequence these patients in numerical order. Specify the index target that requires clinical priority ranking.</p>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-amber-700 block mb-1 uppercase tracking-wide">Priority Target Index</label>
                                                <select value={form.correctPriorityOrder} onChange={e => setForm({ ...form, correctPriorityOrder: Number(e.target.value) })} className="h-9 px-3 border border-amber-300 rounded-xl outline-none font-bold bg-white text-amber-900 shadow-inner">
                                                    {form.patients.map((_, idx) => <option key={idx} value={idx}>Patient #{idx + 1}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Tab 2: Patients List */}
                        {activeTab === 'patients-list' && (
                            <div className="p-6 overflow-y-auto flex-1 bg-white">
                                <div className="flex gap-6 animate-fade h-full min-h-[50vh]">
                                    {/* Left Sidebar */}
                                    <div className="w-48 shrink-0 flex flex-col justify-between bg-gray-50 p-3 rounded-2xl border border-gray-100">
                                        <div className="space-y-1.5">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block px-2 mb-2">Patients Deck</span>
                                            {form.patients.map((pt, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => {
                                                        setActivePatientIndex(idx);
                                                        setPatientSubTab('profile');
                                                    }}
                                                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between group transition-all ${activePatientIndex === idx
                                                        ? 'bg-purple-600 text-white shadow-md'
                                                        : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-100/50'
                                                        }`}
                                                >
                                                    <span className="truncate flex items-center gap-1.5">
                                                        <HeartPulse size={12} /> #{idx + 1}: {pt.correctTriageCategory || 'Unset'}
                                                    </span>
                                                    {form.patients.length > 1 && (
                                                        <Trash2
                                                            size={13}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                removePatientFromForm(idx);
                                                            }}
                                                            className={`opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 ${activePatientIndex === idx ? 'hover:bg-purple-700 text-purple-200' : 'hover:bg-red-50 text-red-500'}`}
                                                        />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={addPatientToForm}
                                            className="w-full py-2 bg-purple-50 text-purple-700 border border-purple-200 border-dashed rounded-xl font-bold text-xs flex items-center justify-center gap-1 hover:bg-purple-100 transition-colors mt-4"
                                        >
                                            <Plus size={14} /> Append Patient
                                        </button>
                                    </div>

                                    {/* Right Content */}
                                    <div className="flex-1 border border-gray-100 rounded-3xl p-5 shadow-inner bg-gray-50/30 flex flex-col">
                                        {/* Sub-tabs */}
                                        <div className="flex border-b border-gray-200 mb-4 text-xs font-bold text-gray-400 gap-4 pb-1">
                                            {[
                                                { id: 'profile', label: 'Patient Core File Card', icon: HeartPulse },
                                                { id: 'rpm', label: 'Sequential RPM Quiz Engine', icon: ClipboardList },
                                                { id: 'ehr', label: 'EHR Intervention Options', icon: ShieldQuestion }
                                            ].map(sub => (
                                                <button
                                                    key={sub.id}
                                                    type="button"
                                                    onClick={() => setPatientSubTab(sub.id)}
                                                    className={`pb-2 border-b-2 flex items-center gap-1.5 transition-colors uppercase tracking-wider ${patientSubTab === sub.id ? 'border-purple-600 text-purple-600 font-extrabold' : 'border-transparent hover:text-gray-600'}`}
                                                >
                                                    <sub.icon size={13} />
                                                    {sub.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Profile Sub-tab */}
                                        {patientSubTab === 'profile' && (
                                            <div className="space-y-4 animate-fade">
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Age Allocation</label>
                                                        <input type="text" placeholder="e.g., ~30s or Pediatric" value={form.patients[activePatientIndex]?.patientAge || ''} onChange={e => updatePatientField('patientAge', e.target.value)} className="w-full h-9 border border-gray-200 rounded-lg px-2 font-bold bg-white outline-none" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Biological Sex</label>
                                                        <select value={form.patients[activePatientIndex]?.patientGender || 'Male'} onChange={e => updatePatientField('patientGender', e.target.value)} className="w-full h-9 border border-gray-200 rounded-lg px-2 font-bold bg-white">
                                                            <option value="Male">Male</option><option value="Female">Female</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Correct Tag Protocol Target</label>
                                                        <select value={form.patients[activePatientIndex]?.correctTriageCategory || 'Immediate'} onChange={e => updatePatientField('correctTriageCategory', e.target.value)} className="w-full h-9 border border-purple-200 text-purple-700 rounded-lg px-2 font-extrabold bg-purple-50">
                                                            <option value="Immediate">Immediate (Red)</option>
                                                            <option value="Delayed">Delayed (Yellow)</option>
                                                            <option value="Minor">Minor (Green)</option>
                                                            <option value="Expectant">Expectant (Black)</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="p-3 bg-purple-50/50 border border-purple-100 rounded-xl">
                                                    <label className="block text-[10px] font-bold text-purple-800 uppercase mb-1">Map 3D Patient glb Mesh File Cloud CDN Anchor Link *</label>
                                                    {assetsLoading ? (
                                                        <div className="flex items-center gap-2 text-purple-600 p-2">
                                                            <Loader2 size={14} className="animate-spin" />
                                                            <span className="text-xs">Loading assets...</span>
                                                        </div>
                                                    ) : assetsError ? (
                                                        <div className="text-red-500 text-xs p-2 bg-red-50 rounded-lg">
                                                            {assetsError}
                                                            <button type="button" onClick={() => loadAssets()} className="ml-2 text-purple-600 underline">Retry</button>
                                                        </div>
                                                    ) : availableAssets.length === 0 ? (
                                                        <div className="text-amber-600 text-xs p-2 bg-amber-50 rounded-lg">
                                                            No 3D models found. Go to AR Assets page to upload GLB files first.
                                                        </div>
                                                    ) : (
                                                        <select
                                                            required
                                                            value={form.patients[activePatientIndex]?.downloadURL || ''}
                                                            onChange={e => updatePatientField('downloadURL', e.target.value)}
                                                            className="w-full h-9 bg-white border border-purple-200 rounded-lg text-xs px-2 outline-none font-medium"
                                                        >
                                                            <option value="">-- Select a 3D Patient Model --</option>
                                                            {availableAssets.map((ast, i) => (
                                                                <option key={ast.id || i} value={ast.downloadURL}>
                                                                    {ast.assetName || 'Unnamed Asset'} ({ast.fileSize || '?'} MB)
                                                                </option>
                                                            ))}
                                                        </select>
                                                    )}
                                                    <p className="text-[10px] text-gray-400 mt-1">{availableAssets.length} model(s) available in AR Assets</p>
                                                </div>

                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Interactive Clinical Presentation Scenario Script Details</label>
                                                    <input type="text" placeholder="e.g., Open chest wound with visible respiratory struggle mechanics" value={form.patients[activePatientIndex]?.patientPresentation || ''} onChange={e => updatePatientField('patientPresentation', e.target.value)} className="w-full h-9 border border-gray-200 rounded-lg px-2 bg-white" />
                                                </div>

                                                <div className="p-4 bg-gray-50 border border-gray-200/60 rounded-xl space-y-2">
                                                    <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Initial Blank-State Card Pillars (Revealed item after asset touch assessments)</span>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <div>
                                                            <label className="text-[9px] text-gray-400 font-bold block uppercase mb-1">Respiration (RR) Pill String</label>
                                                            <input type="text" placeholder="RR >30/min" value={form.patients[activePatientIndex]?.vitalSigns?.[0] || ''} onChange={e => {
                                                                const vitals = [...form.patients[activePatientIndex].vitalSigns]; vitals[0] = e.target.value; updatePatientField('vitalSigns', vitals);
                                                            }} className="w-full h-8 border border-gray-200 rounded-md px-2 bg-white font-semibold" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[9px] text-gray-400 font-bold block uppercase mb-1">Perfusion (CR) Pill String</label>
                                                            <input type="text" placeholder="Capillary Refill >2s" value={form.patients[activePatientIndex]?.vitalSigns?.[1] || ''} onChange={e => {
                                                                const vitals = [...form.patients[activePatientIndex].vitalSigns]; vitals[1] = e.target.value; updatePatientField('vitalSigns', vitals);
                                                            }} className="w-full h-8 border border-gray-200 rounded-md px-2 bg-white font-semibold" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[9px] text-gray-400 font-bold block uppercase mb-1">Mental Status (MS) Pill String</label>
                                                            <input type="text" placeholder="Unresponsive / Lethargic" value={form.patients[activePatientIndex]?.vitalSigns?.[2] || ''} onChange={e => {
                                                                const vitals = [...form.patients[activePatientIndex].vitalSigns]; vitals[2] = e.target.value; updatePatientField('vitalSigns', vitals);
                                                            }} className="w-full h-8 border border-gray-200 rounded-md px-2 bg-white font-semibold" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* RPM Sub-tab */}
                                        {patientSubTab === 'rpm' && (
                                            <div className="space-y-4 animate-fade max-h-[44vh] overflow-y-auto pr-1">
                                                <div className="border-l-4 border-emerald-500 pl-3 space-y-2">
                                                    <span className="font-bold text-xs text-emerald-700 block uppercase">Step 1 Quiz Options: Respiration Assessment (R)</span>
                                                    <input type="text" value={form.patients[activePatientIndex]?.rpmAssessment?.respirationQuestion || ''} onChange={e => {
                                                        const rpm = { ...form.patients[activePatientIndex].rpmAssessment, respirationQuestion: e.target.value }; updatePatientField('rpmAssessment', rpm);
                                                    }} className="w-full h-8 border border-gray-200 rounded-md px-2 bg-white font-medium" />
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {[0, 1, 2].map(i => (
                                                            <input key={i} type="text" placeholder={`Option ${i + 1}`} value={form.patients[activePatientIndex]?.rpmAssessment?.respirationOptions?.[i] || ''} onChange={e => {
                                                                const opts = [...form.patients[activePatientIndex].rpmAssessment.respirationOptions]; opts[i] = e.target.value;
                                                                const rpm = { ...form.patients[activePatientIndex].rpmAssessment, respirationOptions: opts }; updatePatientField('rpmAssessment', rpm);
                                                            }} className="h-8 border border-gray-200 rounded-md px-2 bg-white" />
                                                        ))}
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                                                        <div>
                                                            <label className="text-gray-400 block font-bold mb-0.5">Correct Ans Index</label>
                                                            <select value={form.patients[activePatientIndex]?.rpmAssessment?.correctRespirationIndex || 0} onChange={e => {
                                                                const rpm = { ...form.patients[activePatientIndex].rpmAssessment, correctRespirationIndex: Number(e.target.value) }; updatePatientField('rpmAssessment', rpm);
                                                            }} className="h-7 border border-gray-200 bg-white w-full rounded">
                                                                <option value={0}>Option 1</option><option value={1}>Option 2</option><option value={2}>Option 3</option>
                                                            </select>
                                                        </div>
                                                        <div className="col-span-2">
                                                            <label className="text-gray-400 block font-bold mb-0.5">Clinical Evaluation Real-Time Feedback String</label>
                                                            <input type="text" placeholder="Explain answer logic outcome..." value={form.patients[activePatientIndex]?.rpmAssessment?.respirationFeedback || ''} onChange={e => {
                                                                const rpm = { ...form.patients[activePatientIndex].rpmAssessment, respirationFeedback: e.target.value }; updatePatientField('rpmAssessment', rpm);
                                                            }} className="h-7 border border-gray-200 bg-white w-full px-2 rounded" />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="border-l-4 border-amber-500 pl-3 space-y-2 pt-1">
                                                    <span className="font-bold text-xs text-amber-700 block uppercase">Step 2 Quiz Options: Perfusion Assessment (P)</span>
                                                    <input type="text" value={form.patients[activePatientIndex]?.rpmAssessment?.perfusionQuestion || ''} onChange={e => {
                                                        const rpm = { ...form.patients[activePatientIndex].rpmAssessment, perfusionQuestion: e.target.value }; updatePatientField('rpmAssessment', rpm);
                                                    }} className="w-full h-8 border border-gray-200 rounded-md px-2 bg-white font-medium" />
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {[0, 1, 2].map(i => (
                                                            <input key={i} type="text" placeholder={`Option ${i + 1}`} value={form.patients[activePatientIndex]?.rpmAssessment?.perfusionOptions?.[i] || ''} onChange={e => {
                                                                const opts = [...form.patients[activePatientIndex].rpmAssessment.perfusionOptions]; opts[i] = e.target.value;
                                                                const rpm = { ...form.patients[activePatientIndex].rpmAssessment, perfusionOptions: opts }; updatePatientField('rpmAssessment', rpm);
                                                            }} className="h-8 border border-gray-200 rounded-md px-2 bg-white" />
                                                        ))}
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                                                        <div>
                                                            <label className="text-gray-400 block font-bold mb-0.5">Correct Ans Index</label>
                                                            <select value={form.patients[activePatientIndex]?.rpmAssessment?.correctPerfusionIndex || 0} onChange={e => {
                                                                const rpm = { ...form.patients[activePatientIndex].rpmAssessment, correctPerfusionIndex: Number(e.target.value) }; updatePatientField('rpmAssessment', rpm);
                                                            }} className="h-7 border border-gray-200 bg-white w-full rounded">
                                                                <option value={0}>Option 1</option><option value={1}>Option 2</option><option value={2}>Option 3</option>
                                                            </select>
                                                        </div>
                                                        <div className="col-span-2">
                                                            <label className="text-gray-400 block font-bold mb-0.5">Clinical Evaluation Real-Time Feedback String</label>
                                                            <input type="text" placeholder="Explain answer logic outcome..." value={form.patients[activePatientIndex]?.rpmAssessment?.perfusionFeedback || ''} onChange={e => {
                                                                const rpm = { ...form.patients[activePatientIndex].rpmAssessment, perfusionFeedback: e.target.value }; updatePatientField('rpmAssessment', rpm);
                                                            }} className="h-7 border border-gray-200 bg-white w-full px-2 rounded" />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="border-l-4 border-indigo-500 pl-3 space-y-2 pt-1">
                                                    <span className="font-bold text-xs text-indigo-700 block uppercase">Step 3 Quiz Options: Mental Status Assessment (M)</span>
                                                    <input type="text" value={form.patients[activePatientIndex]?.rpmAssessment?.mentalStatusQuestion || ''} onChange={e => {
                                                        const rpm = { ...form.patients[activePatientIndex].rpmAssessment, mentalStatusQuestion: e.target.value }; updatePatientField('rpmAssessment', rpm);
                                                    }} className="w-full h-8 border border-gray-200 rounded-md px-2 bg-white font-medium" />
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {[0, 1, 2].map(i => (
                                                            <input key={i} type="text" placeholder={`Option ${i + 1}`} value={form.patients[activePatientIndex]?.rpmAssessment?.mentalStatusOptions?.[i] || ''} onChange={e => {
                                                                const opts = [...form.patients[activePatientIndex].rpmAssessment.mentalStatusOptions]; opts[i] = e.target.value;
                                                                const rpm = { ...form.patients[activePatientIndex].rpmAssessment, mentalStatusOptions: opts }; updatePatientField('rpmAssessment', rpm);
                                                            }} className="h-8 border border-gray-200 rounded-md px-2 bg-white" />
                                                        ))}
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                                                        <div>
                                                            <label className="text-gray-400 block font-bold mb-0.5">Correct Ans Index</label>
                                                            <select value={form.patients[activePatientIndex]?.rpmAssessment?.correctMentalStatusIndex || 0} onChange={e => {
                                                                const rpm = { ...form.patients[activePatientIndex].rpmAssessment, correctMentalStatusIndex: Number(e.target.value) }; updatePatientField('rpmAssessment', rpm);
                                                            }} className="h-7 border border-gray-200 bg-white w-full rounded">
                                                                <option value={0}>Option 1</option><option value={1}>Option 2</option><option value={2}>Option 3</option>
                                                            </select>
                                                        </div>
                                                        <div className="col-span-2">
                                                            <label className="text-gray-400 block font-bold mb-0.5">Clinical Evaluation Real-Time Feedback String</label>
                                                            <input type="text" placeholder="Explain answer logic outcome..." value={form.patients[activePatientIndex]?.rpmAssessment?.mentalStatusFeedback || ''} onChange={e => {
                                                                const rpm = { ...form.patients[activePatientIndex].rpmAssessment, mentalStatusFeedback: e.target.value }; updatePatientField('rpmAssessment', rpm);
                                                            }} className="h-7 border border-gray-200 bg-white w-full px-2 rounded" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* EHR Sub-tab */}
                                        {patientSubTab === 'ehr' && (
                                            <div className="space-y-3 animate-fade max-h-[44vh] overflow-y-auto pr-1">
                                                <div className="p-3 bg-purple-50/50 border border-purple-100 text-purple-900 rounded-xl mb-1 flex gap-2">
                                                    <ShieldAlert size={14} className="mt-0.5 shrink-0 text-purple-600" />
                                                    <p className="text-[11px] leading-relaxed"><strong>Post-Tag Documentation Rule:</strong> Students must resolve this correct action item query path right after submitting their triage tag in Unity to complete validation processes.</p>
                                                </div>

                                                {[0, 1, 2].map(idx => (
                                                    <div key={idx} className={`p-3 border rounded-xl space-y-2 ${form.patients[activePatientIndex]?.ehrActions?.[idx]?.isCorrectAction ? 'bg-green-50/50 border-green-200' : 'bg-white border-gray-200'}`}>
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-bold text-gray-500 text-[10px] uppercase">Intervention Path Strategy Slot #{idx + 1}</span>
                                                            <label className="flex items-center gap-1 font-bold text-gray-700 cursor-pointer text-[11px]">
                                                                <input
                                                                    type="radio"
                                                                    name={`ehrCorrect_${activePatientIndex}`}
                                                                    checked={form.patients[activePatientIndex]?.ehrActions?.[idx]?.isCorrectAction || false}
                                                                    onChange={() => {
                                                                        const actions = form.patients[activePatientIndex].ehrActions.map((act, i) => ({ ...act, isCorrectAction: i === idx }));
                                                                        updatePatientField('ehrActions', actions);
                                                                    }}
                                                                    className="text-purple-600 focus:ring-purple-500 w-3 h-3"
                                                                />
                                                                Set as Correct Treatment Action
                                                            </label>
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-2">
                                                            <input required type="text" placeholder="Action Label Name (e.g., Run CPR)" value={form.patients[activePatientIndex]?.ehrActions?.[idx]?.actionName || ''} onChange={e => {
                                                                const actions = [...form.patients[activePatientIndex].ehrActions]; actions[idx] = { ...actions[idx], actionName: e.target.value };
                                                                updatePatientField('ehrActions', actions);
                                                            }} className="col-span-1 h-8 px-2 border border-gray-200 rounded bg-white text-xs font-semibold" />
                                                            <input required type="text" placeholder="Justification or penalty message text displayed on selection..." value={form.patients[activePatientIndex]?.ehrActions?.[idx]?.actionDescription || ''} onChange={e => {
                                                                const actions = [...form.patients[activePatientIndex].ehrActions]; actions[idx] = { ...actions[idx], actionDescription: e.target.value };
                                                                updatePatientField('ehrActions', actions);
                                                            }} className="col-span-2 h-8 px-2 border border-gray-200 rounded bg-white text-xs" />
                                                        </div>
                                                    </div>
                                                ))}

                                                <div className="pt-2">
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Textbook Citation / Debrief Description</label>
                                                    <textarea rows={2} placeholder="Justify correct triage execution and medical step variables for post-scenario student summary screens..." value={form.patients[activePatientIndex]?.clinicalExplanation || ''} onChange={e => updatePatientField('clinicalExplanation', e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg bg-white text-xs outline-none focus:border-purple-400 leading-normal" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="p-6 border-t border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-b-3xl">
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest font-mono">Synchronizing Schema Matrix Target Vector</span>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 h-10 rounded-xl font-bold border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors">Cancel</button>
                                <button type="submit" disabled={submitting} className="px-5 h-10 rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-100 disabled:opacity-50 transition-all flex items-center gap-2">
                                    {submitting ? <><Loader2 size={14} className="animate-spin" /> Publishing To Cloud...</> : 'Publish Scenario'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}