import { useState } from 'react';
import { CheckCircle, XCircle, Clock, Users } from 'lucide-react';

const scenarios = [
    {
        id: 'SCN_001',
        title: 'Traumatic Arrest – Code Blue',
        difficulty: 'Easy',
        timeLimit: '3 minutes',
        patients: 1,
        description: 'Patient slumped and unresponsive in chair. Agonal breathing, no pulse, unconscious.',
        correctTag: 'Immediate (Red)',
        isActive: true,
    },
    {
        id: 'SCN_002A',
        title: 'Uncontrolled Hemorrhage',
        difficulty: 'Medium',
        timeLimit: '5 minutes',
        patients: 2,
        description: 'Patient A: Active thigh bleeding, confused, rapid breathing. Requires tourniquet before tagging.',
        correctTag: 'Immediate (Red)',
        isActive: true,
    },
    {
        id: 'SCN_002B',
        title: 'Closed Fracture with Shock',
        difficulty: 'Medium',
        timeLimit: '5 minutes',
        patients: 2,
        description: 'Patient B: Alert, severe leg pain, delayed capillary refill. Must be prioritized after Patient A.',
        correctTag: 'Delayed (Yellow)',
        isActive: true,
    },
    {
        id: 'SCN_003',
        title: 'Mass Casualty with Hazard',
        difficulty: 'Hard',
        timeLimit: '8 minutes',
        patients: 2,
        description: 'Code Orange. Hazmat spill. PPE required before patient assessment.',
        correctTag: 'Variable',
        isActive: false,
    },
];

export default function Scenarios() {
    const [scenarioList, setScenarioList] = useState(scenarios);

    function toggleScenario(id) {
        setScenarioList(prev =>
            prev.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s)
        );
    }

    const difficultyColor = {
        Easy: 'bg-green-100 text-green-700',
        Medium: 'bg-yellow-100 text-yellow-700',
        Hard: 'bg-red-100 text-red-700',
    };

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-semibold text-gray-900">Scenarios</h1>
                <p className="text-gray-500">Manage training scenarios — disable to hide from students</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {scenarioList.map(scenario => (
                    <div
                        key={scenario.id}
                        className={`bg-white rounded-2xl border p-5 transition-opacity ${scenario.isActive
                                ? 'border-gray-200 opacity-100'
                                : 'border-gray-100 opacity-60'
                            }`}
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded-lg text-xs font-medium ${difficultyColor[scenario.difficulty]}`}>
                                    {scenario.difficulty}
                                </span>
                                <span className="text-xs text-gray-400">{scenario.id}</span>
                            </div>
                            <button
                                onClick={() => toggleScenario(scenario.id)}
                                className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${scenario.isActive
                                        ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    }`}
                            >
                                {scenario.isActive
                                    ? <><CheckCircle size={12} /> Active</>
                                    : <><XCircle size={12} /> Disabled</>
                                }
                            </button>
                        </div>

                        <h3 className="font-semibold text-gray-900 mb-1">
                            {scenario.title}
                        </h3>
                        <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                            {scenario.description}
                        </p>

                        <div className="flex items-center gap-4 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                                <Clock size={12} />
                                {scenario.timeLimit}
                            </span>
                            <span className="flex items-center gap-1">
                                <Users size={12} />
                                {scenario.patients} patient{scenario.patients > 1 ? 's' : ''}
                            </span>
                            <span className="flex items-center gap-1">
                                <CheckCircle size={12} />
                                {scenario.correctTag}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}