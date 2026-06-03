import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import {
    collection, getDocs, doc, addDoc, updateDoc, deleteDoc,
    serverTimestamp, query, orderBy, writeBatch
} from 'firebase/firestore';
import {
    CheckCircle, XCircle, Clock, Users, PlusCircle,
    Edit3, X, Loader2, Info, Activity, ShieldAlert, Plus, Trash2, ShieldQuestion, HeartPulse, ClipboardList, GripVertical, ListOrdered
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ENABLE scenario creation
const IS_SCENARIO_CREATION_ENABLED = true;

// Pre-defined 3D patient models available in Unity Resources folder
const AVAILABLE_PATIENT_MODELS = [
    { id: 'Patient_Standard', name: 'Standard Adult Patient', description: 'Normal adult patient model' },
    { id: 'Patient_Senior', name: 'Senior/Elderly Patient', description: 'Elderly patient model' },
    { id: 'Patient_Pregnant', name: 'Pregnant Patient', description: 'Pregnant patient model' },
    { id: 'Patient_Child', name: 'Child Patient', description: 'Pediatric patient model' },
    { id: 'Patient_Hemorrhage', name: 'Hemorrhage Patient', description: 'Patient with bleeding wounds' },
    { id: 'Patient_Fracture', name: 'Fracture Patient', description: 'Patient with leg fracture' },
    { id: 'Patient_Unconcious', name: 'Unconscious Patient', description: 'Patient Unconcious' },
    { id: 'Patient_Burnt', name: 'Burnt Patient', description: 'Patient with burns' },
    { id: 'Patient_Diabetic', name: 'Diabetic Patient', description: 'Patient with diabetes' },
    { id: 'Patient_Limp', name: 'Limping Patient', description: 'Patient with mobility issues' },
    { id: 'Patient_Anxiety', name: 'Anxious Patient', description: 'Patient with anxiety' },
    { id: 'Patient_Disaster', name: 'Disaster Victim', description: 'Patient affected by disaster scenario' }
];

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
                {scenario.isMultiPatient && scenario.priorityOptions && scenario.priorityOptions.length > 0 && (
                    <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[10px]">
                        Priority Order Active
                    </span>
                )}
            </div>
        </div>
    );
}

export default function Scenarios() {
    const { profile } = useAuth();
    const [scenarios, setScenarios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [reordering, setReordering] = useState(false);

    const [difficultyFilter, setDifficultyFilter] = useState('All');

    const [showModal, setShowModal] = useState(false);
    const [editingScenarioId, setEditingScenarioId] = useState(null);
    const [activeTab, setActiveTab] = useState('scenario-identity');
    const [activePatientIndex, setActivePatientIndex] = useState(0);
    const [patientSubTab, setPatientSubTab] = useState('profile');

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const getBlankPatientTemplate = () => ({
        patientAge: '~40s',
        patientGender: 'Male',
        patientPresentation: '',
        vitalSigns: ['', '', ''],
        patientModelName: 'Patient_Standard',
        correctTriageCategory: 'Immediate',
        rpmAssessment: {
            respirationQuestion: 'What is the patient\'s breathing rate?',
            respirationOptions: ['Normal (<30/min)', 'Rapid (>30/min)', 'Absent/Agonal'],
            correctRespirationIndex: 0,
            respirationFeedback: '',
            perfusionQuestion: 'What is the patient\'s perfusion status?',
            perfusionOptions: ['Normal capillary refill (<2s)', 'Delayed capillary refill (>2s)', 'No palpable pulse'],
            correctPerfusionIndex: 0,
            perfusionFeedback: '',
            mentalStatusQuestion: 'What is the patient\'s mental status?',
            mentalStatusOptions: ['Alert and oriented', 'Confused/disoriented', 'Unresponsive'],
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
        // NEW: Priority Order fields (scenario level for Multi-Patient)
        priorityQuestion: 'Which patient requires immediate attention FIRST?',
        priorityOptions: ['Patient A should be treated FIRST', 'Patient B should be treated FIRST'],
        correctPriorityIndex: 0,
        patients: [getBlankPatientTemplate()],
        isActive: true,
        orderIndex: 0
    };

    const [form, setForm] = useState(initialFormState);
    const isITAdmin = profile?.role === 'it_admin';

    useEffect(() => {
        loadScenarios();
    }, []);

    async function loadScenarios() {
        setLoading(true);
        try {
            let scenariosData = [];
            try {
                const scSnap = await getDocs(query(collection(db, 'scenarios'), orderBy('orderIndex', 'asc')));
                scenariosData = scSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (orderError) {
                const scSnap = await getDocs(collection(db, 'scenarios'));
                scenariosData = scSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                scenariosData.sort((a, b) => (a.orderIndex || 999) - (b.orderIndex || 999));
            }
            setScenarios(scenariosData);
        } catch (e) {
            console.error('Failed to load scenarios:', e);
        } finally {
            setLoading(false);
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
            setScenarios(reorderedScenarios.map((s, i) => ({ ...s, orderIndex: i })));
        } catch (error) {
            console.error('Failed to reorder:', error);
            alert('Failed to save new order.');
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

    const getPatientCount = (scenario) => scenario.patients?.length || 1;

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
        if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
        try {
            await deleteDoc(doc(db, 'scenarios', id));
            setScenarios(prev => prev.filter(s => s.id !== id));
        } catch (e) {
            alert('Failed to delete: ' + e.message);
        }
    }

    function openCreateModal() {
        if (!IS_SCENARIO_CREATION_ENABLED && !isITAdmin) {
            alert('Scenario creation is currently disabled.');
            return;
        }
        setEditingScenarioId(null);
        const maxOrder = scenarios.length > 0 ? Math.max(...scenarios.map(s => s.orderIndex ?? 0)) : -1;
        setForm({ ...initialFormState, orderIndex: maxOrder + 1 });
        setActiveTab('scenario-identity');
        setActivePatientIndex(0);
        setPatientSubTab('profile');
        setShowModal(true);
    }

    function openEditModal(scenario) {
        setEditingScenarioId(scenario.id);
        setForm(JSON.parse(JSON.stringify({ ...initialFormState, ...scenario })));
        setActiveTab('scenario-identity');
        setActivePatientIndex(0);
        setPatientSubTab('profile');
        setShowModal(true);
    }

    const addPatientToForm = () => {
        const newPatientCount = form.patients.length + 1;
        // Update priority options based on new patient count
        let newPriorityOptions = [...form.priorityOptions];
        if (newPatientCount === 2 && form.priorityOptions.length < 2) {
            newPriorityOptions = ['Patient A should be treated FIRST', 'Patient B should be treated FIRST'];
        } else if (newPatientCount === 3 && form.priorityOptions.length < 3) {
            newPriorityOptions = ['Patient A should be treated FIRST', 'Patient B should be treated FIRST', 'Patient C should be treated FIRST'];
        }
        
        setForm({
            ...form,
            isMultiPatient: true,
            patients: [...form.patients, getBlankPatientTemplate()],
            priorityOptions: newPriorityOptions
        });
        setActivePatientIndex(form.patients.length);
    };

    const removePatientFromForm = (indexToRemove) => {
        if (form.patients.length <= 1) return;
        const filteredPatients = form.patients.filter((_, idx) => idx !== indexToRemove);
        const newPatientCount = filteredPatients.length;
        
        // Update priority options based on new patient count
        let newPriorityOptions = [...form.priorityOptions];
        if (newPatientCount === 2) {
            newPriorityOptions = ['Patient A should be treated FIRST', 'Patient B should be treated FIRST'];
        } else if (newPatientCount === 1) {
            newPriorityOptions = [];
        }
        
        setForm({
            ...form,
            isMultiPatient: filteredPatients.length > 1,
            patients: filteredPatients,
            priorityOptions: newPriorityOptions,
            correctPriorityIndex: Math.min(form.correctPriorityIndex, newPatientCount - 1)
        });
        setActivePatientIndex(0);
    };

    const updatePriorityOption = (index, value) => {
        const newOptions = [...form.priorityOptions];
        newOptions[index] = value;
        setForm({ ...form, priorityOptions: newOptions });
    };

    const updatePatientField = (field, value) => {
        const updatedPatients = [...form.patients];
        updatedPatients[activePatientIndex] = { ...updatedPatients[activePatientIndex], [field]: value };
        setForm({ ...form, patients: updatedPatients });
    };

    const updateRPMField = (rpmField, value) => {
        const updatedPatients = [...form.patients];
        updatedPatients[activePatientIndex].rpmAssessment = { ...updatedPatients[activePatientIndex].rpmAssessment, [rpmField]: value };
        setForm({ ...form, patients: updatedPatients });
    };

    const updateRPMOption = (optionType, index, value) => {
        const updatedPatients = [...form.patients];
        const options = [...updatedPatients[activePatientIndex].rpmAssessment[optionType]];
        options[index] = value;
        updatedPatients[activePatientIndex].rpmAssessment[optionType] = options;
        setForm({ ...form, patients: updatedPatients });
    };

    const updateEHRAction = (actionIndex, field, value) => {
        const updatedPatients = [...form.patients];
        updatedPatients[activePatientIndex].ehrActions[actionIndex] = {
            ...updatedPatients[activePatientIndex].ehrActions[actionIndex],
            [field]: value
        };
        setForm({ ...form, patients: updatedPatients });
    };

    const setCorrectEHRAction = (actionIndex) => {
        const updatedPatients = [...form.patients];
        updatedPatients[activePatientIndex].ehrActions = updatedPatients[activePatientIndex].ehrActions.map((action, idx) => ({
            ...action,
            isCorrectAction: idx === actionIndex
        }));
        setForm({ ...form, patients: updatedPatients });
    };

    async function handleFormSubmit(e) {
        e.preventDefault();
        setSubmitting(true);

        const maxOrder = scenarios.length > 0 ? Math.max(...scenarios.map(s => s.orderIndex ?? 0)) : -1;
        const isMultiPatient = form.patients.length > 1;
        
        // For non-multi-patient scenarios, clear priority fields
        const priorityQuestion = isMultiPatient ? form.priorityQuestion : '';
        const priorityOptions = isMultiPatient ? form.priorityOptions : [];
        const correctPriorityIndex = isMultiPatient ? (form.correctPriorityIndex || 0) : 0;

        const payload = {
            scenarioID: form.scenarioID || `SCN_${Date.now().toString().slice(-4)}`,
            scenarioTitle: form.scenarioTitle,
            scenarioDescription: form.scenarioDescription,
            difficulty: form.difficulty,
            emergencyCode: form.emergencyCode || 'None',
            timeLimitSeconds: Number(form.timeLimitSeconds),
            isMultiPatient: isMultiPatient,
            correctPriorityOrder: form.correctPriorityOrder || 0,
            // Priority Order fields for Multi-Patient scenarios
            priorityQuestion: priorityQuestion,
            priorityOptions: priorityOptions,
            correctPriorityIndex: correctPriorityIndex,
            patients: form.patients,
            isActive: form.isActive,
            orderIndex: form.orderIndex ?? maxOrder + 1,
            updatedAt: serverTimestamp()
        };

        if (!editingScenarioId) {
            payload.createdAt = serverTimestamp();
            payload.createdBy = profile?.email || 'Instructor';
        }

        try {
            if (editingScenarioId) {
                await updateDoc(doc(db, 'scenarios', editingScenarioId), payload);
            } else {
                await addDoc(collection(db, 'scenarios'), payload);
            }
            setShowModal(false);
            await loadScenarios();
        } catch (e) {
            console.error('Save error:', e);
            alert('Failed to save scenario: ' + e.message);
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
                    <h1 className="text-2xl font-semibold text-gray-900">Scenarios Manager</h1>
                    <p className="text-gray-500">Create and manage clinical scenarios for the AR training app</p>
                    {reordering && <p className="text-xs text-purple-600 mt-1 animate-pulse">Saving order...</p>}
                </div>

                {isITAdmin && (
                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-md"
                    >
                        <PlusCircle size={18} /> New Scenario
                    </button>
                )}
            </div>

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
                        {tab} ({tab === 'All' ? scenarios.length : scenarios.filter(s => s.difficulty === tab).length})
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="py-24 text-center text-gray-400 font-medium">
                    <Loader2 className="animate-spin mx-auto mb-2" size={32} />
                    Loading scenarios...
                </div>
            ) : filteredScenarios.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center text-gray-400">
                    <Activity className="mx-auto mb-3 opacity-20" size={48} />
                    No scenarios found. Click "New Scenario" to create one.
                </div>
            ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={filteredScenarios.map(s => s.id)} strategy={verticalListSortingStrategy}>
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

            {/* Modal for Create/Edit */}
            {showModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <form onSubmit={handleFormSubmit} className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl border border-gray-100 max-h-[92vh] flex flex-col">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-3xl">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">{editingScenarioId ? 'Edit Scenario' : 'Create New Scenario'}</h2>
                                <p className="text-xs text-gray-500 mt-0.5">Configure scenario parameters for Unity AR app</p>
                            </div>
                            <button type="button" onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-gray-100 bg-gray-50/30 px-6 space-x-2 text-xs font-bold uppercase tracking-wider">
                            <button
                                type="button"
                                onClick={() => setActiveTab('scenario-identity')}
                                className={`px-4 py-3 border-b-2 transition-all ${activeTab === 'scenario-identity' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-400'}`}
                            >
                                1. Scenario Settings
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('priority-order')}
                                className={`px-4 py-3 border-b-2 transition-all flex items-center gap-1.5 ${activeTab === 'priority-order' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-400'}`}
                            >
                                <ListOrdered size={14} /> Priority Order
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('patients-list')}
                                className={`px-4 py-3 border-b-2 transition-all flex items-center gap-1.5 ${activeTab === 'patients-list' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-400'}`}
                            >
                                2. Patients ({form.patients.length})
                            </button>
                        </div>

                        {/* Tab 1: Scenario Identity */}
                        {activeTab === 'scenario-identity' && (
                            <div className="p-6 overflow-y-auto flex-1 bg-white">
                                <div className="space-y-4 max-w-2xl">
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Scenario ID *</label>
                                            <input required type="text" placeholder="SCN_002" value={form.scenarioID} onChange={e => setForm({ ...form, scenarioID: e.target.value.toUpperCase() })} className="w-full h-10 border border-gray-200 rounded-xl px-3 outline-none font-mono font-bold text-purple-700 bg-gray-50" />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Scenario Title *</label>
                                            <input required type="text" placeholder="e.g., Multiple Trauma Incident" value={form.scenarioTitle} onChange={e => setForm({ ...form, scenarioTitle: e.target.value })} className="w-full h-10 border border-gray-200 rounded-xl px-3 outline-none font-semibold bg-gray-50" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Description</label>
                                        <textarea rows={2} placeholder="Scenario description..." value={form.scenarioDescription} onChange={e => setForm({ ...form, scenarioDescription: e.target.value })} className="w-full border border-gray-200 rounded-xl p-3 outline-none text-gray-600 bg-gray-50" />
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Difficulty</label>
                                            <select value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })} className="w-full h-10 border border-gray-200 rounded-xl px-3 outline-none bg-gray-50">
                                                <option value="Easy">Easy</option>
                                                <option value="Medium">Medium</option>
                                                <option value="Hard">Hard</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Emergency Code</label>
                                            <select value={form.emergencyCode} onChange={e => setForm({ ...form, emergencyCode: e.target.value })} className="w-full h-10 border border-gray-200 rounded-xl px-3 outline-none bg-gray-50">
                                                <option value="None">None</option>
                                                <option value="CodeBlue">Code Blue</option>
                                                <option value="CodeRed">Code Red</option>
                                                <option value="CodeOrange">Code Orange</option>
                                                <option value="CodeSilver">Code Silver</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Time Limit (seconds)</label>
                                            <input type="number" value={form.timeLimitSeconds} onChange={e => setForm({ ...form, timeLimitSeconds: Number(e.target.value) })} className="w-full h-10 border border-gray-200 rounded-xl px-3 outline-none bg-gray-50" />
                                        </div>
                                    </div>

                                    <div className="p-3 bg-gray-50 rounded-xl">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Display Order</label>
                                        <input type="number" value={form.orderIndex} onChange={e => setForm({ ...form, orderIndex: Number(e.target.value) })} className="w-24 h-9 border border-gray-200 rounded-lg px-3 font-bold bg-white" />
                                        <p className="text-[10px] text-gray-400 mt-1">Lower numbers appear first. Drag cards to reorder.</p>
                                    </div>

                                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4 rounded text-purple-600" />
                                            <span className="text-sm font-medium text-gray-700">Scenario is Active</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab 2: Priority Order (for Multi-Patient) */}
                        {activeTab === 'priority-order' && (
                            <div className="p-6 overflow-y-auto flex-1 bg-white">
                                <div className="max-w-xl mx-auto space-y-5">
                                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                                        <h3 className="font-bold text-amber-800 text-sm mb-2 flex items-center gap-2">
                                            <ListOrdered size={16} /> Priority Order Configuration
                                        </h3>
                                        <p className="text-xs text-amber-700 mb-3">
                                            This determines which patient students must select as FIRST when multiple patients are present.
                                            The priority panel will appear AFTER all patients have been assessed.
                                        </p>
                                        {form.patients.length <= 1 ? (
                                            <div className="p-4 bg-gray-100 rounded-xl text-center text-gray-500 text-sm">
                                                <Users size={24} className="mx-auto mb-2 opacity-30" />
                                                Add at least 2 patients to enable priority order
                                            </div>
                                        ) : (
                                            <>
                                                <div className="mb-4">
                                                    <label className="block text-xs font-bold text-amber-800 uppercase mb-1">Priority Question</label>
                                                    <input
                                                        type="text"
                                                        value={form.priorityQuestion}
                                                        onChange={e => setForm({ ...form, priorityQuestion: e.target.value })}
                                                        className="w-full h-10 border border-amber-300 rounded-xl px-3 bg-white"
                                                        placeholder="Which patient requires immediate attention FIRST?"
                                                    />
                                                </div>

                                                <div className="space-y-3">
                                                    <label className="block text-xs font-bold text-amber-800 uppercase mb-1">Priority Options</label>
                                                    {form.priorityOptions.map((option, idx) => (
                                                        <div key={idx} className="flex items-center gap-2">
                                                            <span className="text-sm font-bold text-amber-700 w-20">Patient {String.fromCharCode(65 + idx)}:</span>
                                                            <input
                                                                type="text"
                                                                value={option}
                                                                onChange={e => updatePriorityOption(idx, e.target.value)}
                                                                className="flex-1 h-10 border border-amber-200 rounded-xl px-3 bg-white"
                                                                placeholder={`Option for Patient ${String.fromCharCode(65 + idx)}`}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="mt-4">
                                                    <label className="block text-xs font-bold text-amber-800 uppercase mb-1">Correct Priority Index</label>
                                                    <select
                                                        value={form.correctPriorityIndex}
                                                        onChange={e => setForm({ ...form, correctPriorityIndex: Number(e.target.value) })}
                                                        className="w-full h-10 border border-amber-300 rounded-xl px-3 bg-white font-medium"
                                                    >
                                                        {form.patients.map((_, idx) => (
                                                            <option key={idx} value={idx}>
                                                                Patient {String.fromCharCode(65 + idx)} should be treated FIRST - {form.priorityOptions[idx] || `Option ${idx + 1}`}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <p className="text-[10px] text-amber-600 mt-2">
                                                        Students must select this option to receive +1 priority point.
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab 3: Patients List */}
                        {activeTab === 'patients-list' && (
                            <div className="p-6 overflow-y-auto flex-1 bg-white">
                                <div className="flex gap-6 h-full min-h-[60vh]">
                                    {/* Patient Sidebar */}
                                    <div className="w-48 shrink-0 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                                        <div className="space-y-1.5">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase block px-2 mb-2">Patients</span>
                                            {form.patients.map((pt, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => { setActivePatientIndex(idx); setPatientSubTab('profile'); }}
                                                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between group transition-all ${activePatientIndex === idx
                                                        ? 'bg-purple-600 text-white shadow-md'
                                                        : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-100'
                                                    }`}
                                                >
                                                    <span className="truncate flex items-center gap-1.5">
                                                        <HeartPulse size={12} /> Patient {String.fromCharCode(65 + idx)}
                                                    </span>
                                                    {form.patients.length > 1 && (
                                                        <Trash2 size={13} onClick={(e) => { e.stopPropagation(); removePatientFromForm(idx); }} className="opacity-0 group-hover:opacity-100 text-red-500" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                        <button type="button" onClick={addPatientToForm} className="w-full mt-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 border-dashed rounded-xl font-bold text-xs flex items-center justify-center gap-1 hover:bg-purple-100">
                                            <Plus size={14} /> Add Patient
                                        </button>
                                    </div>

                                    {/* Patient Details */}
                                    <div className="flex-1 border border-gray-100 rounded-2xl p-5 shadow-inner bg-gray-50/30 flex flex-col">
                                        {/* Sub-tabs */}
                                        <div className="flex border-b border-gray-200 mb-4 text-xs font-bold text-gray-400 gap-4 pb-1">
                                            {[
                                                { id: 'profile', label: 'Patient Profile', icon: HeartPulse },
                                                { id: 'rpm', label: 'RPM Assessment', icon: ClipboardList },
                                                { id: 'ehr', label: 'EHR Actions', icon: ShieldQuestion }
                                            ].map(sub => (
                                                <button key={sub.id} type="button" onClick={() => setPatientSubTab(sub.id)} className={`pb-2 border-b-2 flex items-center gap-1.5 transition-colors ${patientSubTab === sub.id ? 'border-purple-600 text-purple-600 font-bold' : 'border-transparent hover:text-gray-600'}`}>
                                                    <sub.icon size={13} /> {sub.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Profile Sub-tab */}
                                        {patientSubTab === 'profile' && (
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Age</label>
                                                        <input type="text" value={form.patients[activePatientIndex]?.patientAge || ''} onChange={e => updatePatientField('patientAge', e.target.value)} className="w-full h-9 border border-gray-200 rounded-lg px-2 bg-white" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Gender</label>
                                                        <select value={form.patients[activePatientIndex]?.patientGender || 'Male'} onChange={e => updatePatientField('patientGender', e.target.value)} className="w-full h-9 border border-gray-200 rounded-lg px-2 bg-white">
                                                            <option value="Male">Male</option><option value="Female">Female</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">3D Patient Model</label>
                                                    <select value={form.patients[activePatientIndex]?.patientModelName || 'Patient_Default'} onChange={e => updatePatientField('patientModelName', e.target.value)} className="w-full h-9 border border-purple-200 rounded-lg px-2 bg-purple-50 text-purple-700 font-medium">
                                                        {AVAILABLE_PATIENT_MODELS.map(model => (
                                                            <option key={model.id} value={model.id}>{model.name} - {model.description}</option>
                                                        ))}
                                                    </select>
                                                    <p className="text-[10px] text-gray-400 mt-1">Models are pre-loaded in Unity app</p>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Presentation</label>
                                                    <input type="text" value={form.patients[activePatientIndex]?.patientPresentation || ''} onChange={e => updatePatientField('patientPresentation', e.target.value)} className="w-full h-9 border border-gray-200 rounded-lg px-2 bg-white" />
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Correct Triage Category</label>
                                                    <select value={form.patients[activePatientIndex]?.correctTriageCategory || 'Immediate'} onChange={e => updatePatientField('correctTriageCategory', e.target.value)} className="w-full h-9 border border-purple-200 rounded-lg px-2 bg-purple-50 font-bold">
                                                        <option value="Immediate">Immediate (Red)</option>
                                                        <option value="Delayed">Delayed (Yellow)</option>
                                                        <option value="Minor">Minor (Green)</option>
                                                        <option value="Expectant">Expectant (Black)</option>
                                                    </select>
                                                </div>

                                                <div className="p-3 bg-gray-50 rounded-xl">
                                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Vital Signs (for info card)</label>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <div>
                                                            <label className="text-[9px] text-gray-400">Respiration</label>
                                                            <input type="text" placeholder="e.g., RR >30/min" value={form.patients[activePatientIndex]?.vitalSigns?.[0] || ''} onChange={e => {
                                                                const vitals = [...(form.patients[activePatientIndex]?.vitalSigns || ['', '', ''])];
                                                                vitals[0] = e.target.value;
                                                                updatePatientField('vitalSigns', vitals);
                                                            }} className="w-full h-8 border border-gray-200 rounded-md px-2 text-sm" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[9px] text-gray-400">Perfusion</label>
                                                            <input type="text" placeholder="e.g., CRT >2s" value={form.patients[activePatientIndex]?.vitalSigns?.[1] || ''} onChange={e => {
                                                                const vitals = [...(form.patients[activePatientIndex]?.vitalSigns || ['', '', ''])];
                                                                vitals[1] = e.target.value;
                                                                updatePatientField('vitalSigns', vitals);
                                                            }} className="w-full h-8 border border-gray-200 rounded-md px-2 text-sm" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[9px] text-gray-400">Mental Status</label>
                                                            <input type="text" placeholder="e.g., Alert & Oriented" value={form.patients[activePatientIndex]?.vitalSigns?.[2] || ''} onChange={e => {
                                                                const vitals = [...(form.patients[activePatientIndex]?.vitalSigns || ['', '', ''])];
                                                                vitals[2] = e.target.value;
                                                                updatePatientField('vitalSigns', vitals);
                                                            }} className="w-full h-8 border border-gray-200 rounded-md px-2 text-sm" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* RPM Sub-tab */}
                                        {patientSubTab === 'rpm' && (
                                            <div className="space-y-4 overflow-y-auto pr-1 max-h-[55vh]">
                                                {/* Respiration */}
                                                <div className="border-l-4 border-green-500 pl-3">
                                                    <span className="font-bold text-xs text-green-700 block uppercase">Respiration Assessment</span>
                                                    <input type="text" value={form.patients[activePatientIndex]?.rpmAssessment?.respirationQuestion || ''} onChange={e => updateRPMField('respirationQuestion', e.target.value)} className="w-full h-8 border border-gray-200 rounded-md px-2 mt-1 text-sm" />
                                                    <div className="grid grid-cols-3 gap-2 mt-2">
                                                        {[0, 1, 2].map(i => (
                                                            <input key={i} type="text" placeholder={`Option ${i + 1}`} value={form.patients[activePatientIndex]?.rpmAssessment?.respirationOptions?.[i] || ''} onChange={e => updateRPMOption('respirationOptions', i, e.target.value)} className="h-8 border border-gray-200 rounded-md px-2 text-sm" />
                                                        ))}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                                        <select value={form.patients[activePatientIndex]?.rpmAssessment?.correctRespirationIndex || 0} onChange={e => updateRPMField('correctRespirationIndex', Number(e.target.value))} className="h-8 border border-gray-200 rounded-md px-2 text-sm">
                                                            <option value={0}>Correct: Option 1</option><option value={1}>Correct: Option 2</option><option value={2}>Correct: Option 3</option>
                                                        </select>
                                                        <input type="text" placeholder="Feedback" value={form.patients[activePatientIndex]?.rpmAssessment?.respirationFeedback || ''} onChange={e => updateRPMField('respirationFeedback', e.target.value)} className="h-8 border border-gray-200 rounded-md px-2 text-sm" />
                                                    </div>
                                                </div>

                                                {/* Perfusion */}
                                                <div className="border-l-4 border-yellow-500 pl-3">
                                                    <span className="font-bold text-xs text-yellow-700 block uppercase">Perfusion Assessment</span>
                                                    <input type="text" value={form.patients[activePatientIndex]?.rpmAssessment?.perfusionQuestion || ''} onChange={e => updateRPMField('perfusionQuestion', e.target.value)} className="w-full h-8 border border-gray-200 rounded-md px-2 mt-1 text-sm" />
                                                    <div className="grid grid-cols-3 gap-2 mt-2">
                                                        {[0, 1, 2].map(i => (
                                                            <input key={i} type="text" placeholder={`Option ${i + 1}`} value={form.patients[activePatientIndex]?.rpmAssessment?.perfusionOptions?.[i] || ''} onChange={e => updateRPMOption('perfusionOptions', i, e.target.value)} className="h-8 border border-gray-200 rounded-md px-2 text-sm" />
                                                        ))}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                                        <select value={form.patients[activePatientIndex]?.rpmAssessment?.correctPerfusionIndex || 0} onChange={e => updateRPMField('correctPerfusionIndex', Number(e.target.value))} className="h-8 border border-gray-200 rounded-md px-2 text-sm">
                                                            <option value={0}>Correct: Option 1</option><option value={1}>Correct: Option 2</option><option value={2}>Correct: Option 3</option>
                                                        </select>
                                                        <input type="text" placeholder="Feedback" value={form.patients[activePatientIndex]?.rpmAssessment?.perfusionFeedback || ''} onChange={e => updateRPMField('perfusionFeedback', e.target.value)} className="h-8 border border-gray-200 rounded-md px-2 text-sm" />
                                                    </div>
                                                </div>

                                                {/* Mental Status */}
                                                <div className="border-l-4 border-blue-500 pl-3">
                                                    <span className="font-bold text-xs text-blue-700 block uppercase">Mental Status Assessment</span>
                                                    <input type="text" value={form.patients[activePatientIndex]?.rpmAssessment?.mentalStatusQuestion || ''} onChange={e => updateRPMField('mentalStatusQuestion', e.target.value)} className="w-full h-8 border border-gray-200 rounded-md px-2 mt-1 text-sm" />
                                                    <div className="grid grid-cols-3 gap-2 mt-2">
                                                        {[0, 1, 2].map(i => (
                                                            <input key={i} type="text" placeholder={`Option ${i + 1}`} value={form.patients[activePatientIndex]?.rpmAssessment?.mentalStatusOptions?.[i] || ''} onChange={e => updateRPMOption('mentalStatusOptions', i, e.target.value)} className="h-8 border border-gray-200 rounded-md px-2 text-sm" />
                                                        ))}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                                        <select value={form.patients[activePatientIndex]?.rpmAssessment?.correctMentalStatusIndex || 0} onChange={e => updateRPMField('correctMentalStatusIndex', Number(e.target.value))} className="h-8 border border-gray-200 rounded-md px-2 text-sm">
                                                            <option value={0}>Correct: Option 1</option><option value={1}>Correct: Option 2</option><option value={2}>Correct: Option 3</option>
                                                        </select>
                                                        <input type="text" placeholder="Feedback" value={form.patients[activePatientIndex]?.rpmAssessment?.mentalStatusFeedback || ''} onChange={e => updateRPMField('mentalStatusFeedback', e.target.value)} className="h-8 border border-gray-200 rounded-md px-2 text-sm" />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* EHR Sub-tab */}
                                        {patientSubTab === 'ehr' && (
                                            <div className="space-y-3 overflow-y-auto pr-1 max-h-[55vh]">
                                                {[0, 1, 2].map(idx => (
                                                    <div key={idx} className={`p-3 border rounded-xl ${form.patients[activePatientIndex]?.ehrActions?.[idx]?.isCorrectAction ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="font-bold text-gray-500 text-[10px] uppercase">Action {idx + 1}</span>
                                                            <label className="flex items-center gap-1 text-xs cursor-pointer">
                                                                <input type="radio" name="ehrCorrect" checked={form.patients[activePatientIndex]?.ehrActions?.[idx]?.isCorrectAction || false} onChange={() => setCorrectEHRAction(idx)} className="text-purple-600" />
                                                                Correct Action
                                                            </label>
                                                        </div>
                                                        <input type="text" placeholder="Action Name" value={form.patients[activePatientIndex]?.ehrActions?.[idx]?.actionName || ''} onChange={e => updateEHRAction(idx, 'actionName', e.target.value)} className="w-full h-8 border border-gray-200 rounded-md px-2 text-sm mb-2" />
                                                        <input type="text" placeholder="Description / Feedback" value={form.patients[activePatientIndex]?.ehrActions?.[idx]?.actionDescription || ''} onChange={e => updateEHRAction(idx, 'actionDescription', e.target.value)} className="w-full h-8 border border-gray-200 rounded-md px-2 text-sm" />
                                                    </div>
                                                ))}
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Clinical Explanation</label>
                                                    <textarea rows={2} value={form.patients[activePatientIndex]?.clinicalExplanation || ''} onChange={e => updatePatientField('clinicalExplanation', e.target.value)} className="w-full border border-gray-200 rounded-xl p-2 text-sm" placeholder="Explain the correct triage decision..." />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="p-6 border-t border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-b-3xl">
                            <span className="text-[11px] font-bold text-gray-400">Syncs to Unity app</span>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 h-10 rounded-xl font-bold border border-gray-200 text-gray-500 hover:bg-gray-100">Cancel</button>
                                <button type="submit" disabled={submitting} className="px-5 h-10 rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-lg disabled:opacity-50 flex items-center gap-2">
                                    {submitting ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : (editingScenarioId ? 'Update' : 'Create')}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}