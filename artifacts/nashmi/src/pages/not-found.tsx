import { Link } from "wouter";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center p-8">
        <h1 className="text-8xl font-black text-primary mb-4">404</h1>
        <h2 className="text-2xl font-bold text-foreground mb-4">عذراً، الصفحة غير موجودة</h2>
        <p className="text-muted-foreground mb-8">يبدو أنك ضللت الطريق يا نشمي، لا تقلق، الفزعة هنا!</p>
        <Link href="/">
          <Button size="lg">العودة للرئيسية</Button>
        </Link>
      </div>
    </div>
  );
}
