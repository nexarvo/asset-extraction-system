import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UploadPage } from '../pages/UploadPage';
import { DocumentsPage } from '../pages/DocumentsPage';
import { ROUTES } from '../constants/routes';

export const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={ROUTES.UPLOAD} element={<UploadPage />} />
        <Route path={ROUTES.DOCUMENTS} element={<DocumentsPage />} />
        <Route path={ROUTES.HOME} element={<Navigate to={ROUTES.UPLOAD} replace />} />
      </Routes>
    </BrowserRouter>
  );
};