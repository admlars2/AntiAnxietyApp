import { Routes, Route } from 'react-router-dom';
import Landing from '../pages/Landing/Landing';
import { ROUTES } from './config';

function Router() {
    return (
        <Routes>
            <Route path={ROUTES.landing} element={<Landing />} />
        </Routes>
    );
}

export default Router;