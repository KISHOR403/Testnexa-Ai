import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import RerunResultComparisonView from '../../components/execution/RerunResultComparisonView';

const RunComparisonPage = () => {
    const { runId, rerunId } = useParams();
    const navigate = useNavigate();

    return (
        <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '1.5rem' }}>
            <RerunResultComparisonView
                runId={runId}
                initialRerunId={rerunId || null}
                onSelectRun={(id) => navigate(`/app/runs/${id}`)}
            />
        </div>
    );
};

export default RunComparisonPage;

