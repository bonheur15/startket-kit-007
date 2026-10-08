import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { queryClient } from "./lib/api/query-client";
import { createFileRoutes } from "./router/create-file-router";
import "./index.css";

const router = createBrowserRouter(createFileRoutes());

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Missing #root element in index.html");

ReactDOM.createRoot(rootElement).render(
	<React.StrictMode>
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
			{import.meta.env.DEV && (
				<ReactQueryDevtools
					initialIsOpen={false}
					buttonPosition="bottom-left"
				/>
			)}
		</QueryClientProvider>
	</React.StrictMode>,
);
