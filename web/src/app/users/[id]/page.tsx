import { Hash } from "lucide-react";
import { Link, useParams } from "react-router";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function UserPage() {
	const { id } = useParams();

	return (
		<div className="mx-auto max-w-2xl">
			<PageHeader
				eyebrow="Dynamic route"
				title={
					<span className="flex items-center gap-3">
						User{" "}
						<span className="font-mono text-accent-strong dark:text-accent">
							#{id}
						</span>
					</span>
				}
				description={
					<>
						This page is rendered by{" "}
						<code className="font-mono">src/app/users/[id]/page.tsx</code>. The
						bracketed folder becomes a route parameter.
					</>
				}
			/>
			<Card>
				<CardContent className="p-6">
					<dl className="space-y-3 font-mono text-[13px]">
						<div className="flex items-center justify-between border-b border-line pb-3">
							<dt className="flex items-center gap-2 text-fg-muted">
								<Hash className="size-3.5" aria-hidden />
								useParams().id
							</dt>
							<dd>
								<Badge variant="accent">{id}</Badge>
							</dd>
						</div>
						<div className="flex items-center justify-between">
							<dt className="text-fg-muted">pattern</dt>
							<dd className="text-fg">/users/:id</dd>
						</div>
					</dl>
					<div className="mt-6 flex gap-2">
						<Button asChild variant="outline" size="sm">
							<Link to={`/users/${Number(id ?? 0) + 1}`}>Next id</Link>
						</Button>
						<Button asChild variant="ghost" size="sm">
							<Link to="/about">Routing docs</Link>
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
