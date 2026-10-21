import { createBrowserRouter, RouterProvider } from 'react-router';
import { Providers } from './Providers';
import { routes } from './routes';

const router = createBrowserRouter(routes);

export default function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}
