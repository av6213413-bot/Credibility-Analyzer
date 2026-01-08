import { Routes, Route } from 'react-router-dom';
import { ROUTES } from '@/constants';
import { HomePage } from '@/features/home';
import { AnalysisPage } from '@/features/analysis';
import { HistoryPage } from '@/features/history';
import { NotFoundPage } from './NotFoundPage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path={ROUTES.HOME} element={<HomePage />} />
      <Route path={ROUTES.ANALYSIS} element={<AnalysisPage />} />
      <Route path={ROUTES.HISTORY} element={<HistoryPage />} />
      <Route path={ROUTES.NOT_FOUND} element={<NotFoundPage />} />
    </Routes>
  );
};
