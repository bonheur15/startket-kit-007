import {
	ArrowRight,
	Braces,
	FileJson,
	FolderTree,
	Route,
	ShieldCheck,
	Workflow,
} from "lucide-react";
import { Link } from "react-router";
import { CodeBlock } from "@/components/code-block";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STEPS = [
	{
		n: "01",
		icon: FolderTree,
		title: "Create a folder, export a function",
		body: "The folder is the path, the name prefix is the HTTP method, [param] folders become path parameters.",
		code: `engine/src/api/v1/projects/[id]/rename/index.ts

/** Rename a project. Only the owner may do this. */
export async function updateProject(input: { id: number; name: string }) {
  const user = await requireAuth();
  …
}`,
	},
	{
		n: "02",
		icon: Workflow,
		title: "The generator infers the contract",
		body: "Types become runtime validators and OpenAPI schemas. Date → ISO string, numbers in query strings are coerced, unknown keys are stripped.",
		code: `PUT /api/v1/projects/:id/rename      (auth)

input   { id: number; name: string }
output  { id: number; name: string; updatedAt: string }`,
	},
	{
		n: "03",
		icon: Braces,
		title: "Call it with full types",
		body: "Query hooks for GET, mutation hooks for everything else. Passing a body to a GET is a compile error, not a 400.",
		code: `const rename = useEngineMutation("/projects/:id/rename", {
  onSuccess: () => invalidateEngine("/projects"),
});
rename.mutate({ body: { id: 42, name: "Atlas" } });`,
	},
];

const RULES = [
	["get · list · find · search · fetch", "GET", "query string"],
	["create · post · add", "POST", "JSON body"],
	["update · put", "PUT", "JSON body"],
	["patch · edit", "PATCH", "JSON body"],
	["delete · remove", "DELETE", "query string"],
];

export default function AboutPage() {
	return (
		<div className="space-y-16">
			<PageHeader
				eyebrow="How it works"
				title="One function, one endpoint, zero glue"
				description="The engine, the generator and the web client are designed as a single pipeline. This page walks through it; the README covers every option."
				actions={
					<Button asChild variant="outline">
						<Link to="/health">
							<ShieldCheck className="size-4" aria-hidden />
							Engine status
						</Link>
					</Button>
				}
			/>

			<section className="space-y-6">
				{STEPS.map(({ n, icon: Icon, title, body, code }) => (
					<Card key={n} className="overflow-hidden">
						<div className="grid lg:grid-cols-5">
							<CardContent className="p-6 sm:p-8 lg:col-span-2">
								<div className="mb-4 flex items-center gap-3">
									<span className="font-mono text-xs font-semibold text-accent-strong dark:text-accent">
										{n}
									</span>
									<span className="flex size-9 items-center justify-center rounded-xl bg-surface-2 text-fg">
										<Icon className="size-4" aria-hidden />
									</span>
								</div>
								<h2 className="text-lg font-semibold tracking-tight">
									{title}
								</h2>
								<p className="mt-2 text-sm leading-relaxed text-fg-muted">
									{body}
								</p>
							</CardContent>
							<div className="bg-ink-2 p-4 lg:col-span-3 lg:p-6">
								<CodeBlock
									code={code}
									copy={false}
									className="border-0 shadow-none"
								/>
							</div>
						</div>
					</Card>
				))}
			</section>

			<section className="grid gap-6 lg:grid-cols-2">
				<Card>
					<CardContent className="p-6 sm:p-8">
						<div className="mb-5 flex items-center gap-2">
							<Route
								className="size-4 text-accent-strong dark:text-accent"
								aria-hidden
							/>
							<h2 className="font-semibold">Method inference</h2>
						</div>
						<table className="w-full text-sm">
							<thead>
								<tr className="text-left font-mono text-[11px] uppercase tracking-widest text-fg-subtle">
									<th className="pb-3 font-medium">name starts with</th>
									<th className="pb-3 font-medium">method</th>
									<th className="pb-3 font-medium">input from</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-line">
								{RULES.map(([prefix, method, source]) => (
									<tr key={method}>
										<td className="py-2.5 font-mono text-[13px] text-fg">
											{prefix}
										</td>
										<td className="py-2.5">
											<Badge
												variant={
													method === "GET"
														? "accent"
														: method === "DELETE"
															? "danger"
															: "info"
												}
											>
												{method}
											</Badge>
										</td>
										<td className="py-2.5 text-fg-muted">{source}</td>
									</tr>
								))}
							</tbody>
						</table>
						<p className="mt-4 text-xs text-fg-subtle">
							Any other prefix is a generator error, so an accidental GET
							mutation cannot ship.
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-6 sm:p-8">
						<div className="mb-5 flex items-center gap-2">
							<FileJson
								className="size-4 text-accent-strong dark:text-accent"
								aria-hidden
							/>
							<h2 className="font-semibold">File-based routing (web)</h2>
						</div>
						<dl className="space-y-3 font-mono text-[13px]">
							{[
								["app/page.tsx", "/"],
								["app/about/page.tsx", "/about"],
								["app/users/[id]/page.tsx", "/users/:id"],
								["app/docs/[...slug]/page.tsx", "/docs/*"],
								["app/(protected)/todos/page.tsx", "/todos"],
								["app/layout.tsx", "wraps children"],
								["app/not-found.tsx", "404"],
							].map(([file, route]) => (
								<div
									key={file}
									className="flex items-center justify-between gap-4 border-b border-line pb-3 last:border-0 last:pb-0"
								>
									<dt className="truncate text-fg">{file}</dt>
									<dd className="shrink-0 text-fg-muted">{route}</dd>
								</div>
							))}
						</dl>
						<p className="mt-4 text-xs text-fg-subtle">
							Folders in parentheses group routes without changing the URL; the
							protected group wraps everything in a sign-in guard.
						</p>
					</CardContent>
				</Card>
			</section>

			<section className="bg-grid-ink rounded-3xl bg-ink p-8 text-ink-fg sm:p-12">
				<div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
					<div>
						<p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
							Next
						</p>
						<h2 className="mt-2 text-2xl font-semibold tracking-tight">
							See it running
						</h2>
						<p className="mt-2 max-w-lg text-sm text-ink-muted">
							The todo demo uses every piece: a protected route, four generated
							endpoints, optimistic mutations and cache invalidation.
						</p>
					</div>
					<Button asChild size="lg" variant="accent">
						<Link to="/todos">
							Open the demo
							<ArrowRight className="size-4" aria-hidden />
						</Link>
					</Button>
				</div>
			</section>
		</div>
	);
}
