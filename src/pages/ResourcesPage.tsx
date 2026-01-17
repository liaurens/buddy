import { useState } from 'react';
import Journal from '../features/resources/Journal';
import Toolbox from '../features/resources/Toolbox';

const ResourcesPage = () => {
    const [resourceSubTab, setResourceSubTab] = useState<'journal' | 'toolbox'>('journal');

    return (
        <div className="space-y-6">
            <div className="flex p-1 bg-slate-200 rounded-lg">
                <button
                    onClick={() => setResourceSubTab('journal')}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${resourceSubTab === 'journal' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    Journal
                </button>
                <button
                    onClick={() => setResourceSubTab('toolbox')}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${resourceSubTab === 'toolbox' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    Toolbox
                </button>
            </div>
            {resourceSubTab === 'journal' && <Journal />}
            {resourceSubTab === 'toolbox' && <Toolbox />}
        </div>
    );
};

export default ResourcesPage;
