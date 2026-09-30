import { ButtonLink } from "@/components/ui";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="text-center">
        <Logo className="justify-center" withText={false} />
        <h1 className="mt-8 text-3xl font-extrabold text-ink">Page not found</h1>
        <p className="mt-2 text-slate-500">The page you are looking for does not exist or you do not have access to it.</p>
        <ButtonLink href="/" className="mt-6">Go to home</ButtonLink>
      </div>
    </div>
  );
}
