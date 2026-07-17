import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/providers/trpc";
import { isDemoMode, demoApi } from "@/lib/demoApi";
import AppLayout from "@/components/layout/AppLayout";
import {
  Upload,
  Camera,
  CheckCircle2,
  Loader2,
  Image,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
} from "lucide-react";

export default function SetupImageUpload() {
  const navigate = useNavigate();
  const { jobId } = useParams<{ jobId: string }>();
  const [operator, setOperator] = useState<{ id: number; name: string } | null>(null);
  const [images, setImages] = useState<Array<{ url: string; tag: string }>>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("cnc_operator");
    if (!saved) {
      navigate("/");
      return;
    }
    try {
      setOperator(JSON.parse(saved));
    } catch {
      navigate("/");
    }
  }, [navigate]);

  const jobQuery = trpc.job.getById.useQuery(
    { id: Number(jobId) },
    { enabled: !!jobId && !isNaN(Number(jobId)) && !isDemoMode() }
  );

  const createImage = trpc.setupImage.create.useMutation({
    onSuccess: () => {
      setSaved(true);
      setError("");
    },
    onError: () => {
      if (isDemoMode()) {
        setSaved(true);
        setError("");
        return;
      }
      setError("Failed to save image reference.");
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // In a real system, this would upload to S3/cloud storage
    // For now, we create a local object URL as a placeholder
    const url = URL.createObjectURL(file);
    setImages((prev) => [...prev, { url, tag: "" }]);
    setSaved(false);
  };

  const handleTagImage = (index: number, tag: string) => {
    setImages((prev) =>
      prev.map((img, i) => (i === index ? { ...img, tag } : img))
    );
  };

  const handleSave = () => {
    if (!operator || !jobId) return;

    // Save all images with tags
    images.forEach((img) => {
      if (img.url) {
        createImage.mutate({
          jobId: Number(jobId),
          imageUrl: img.url,
          uploadedBy: operator.id,
        });
      }
    });

    setSaved(true);
  };

  const job = isDemoMode() ? demoApi.getJobById(Number(jobId)) : jobQuery.data;

  return (
    <AppLayout
      title="Setup Photos"
      subtitle={job ? `Job: ${job.jobNumber} | Part: ${job.partNumber}` : ""}
      showBack
      onBack={() => navigate(`/setup-sheet/${jobId}`)}
    >
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Upload Card */}
        <div className="forge-card">
          <div className="forge-card-header">
            <h2 className="forge-card-title flex items-center gap-2">
              <Camera className="h-4 w-4 text-blue-400" />
              Upload Setup Photo
            </h2>
          </div>
          <div className="forge-card-body space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              className="w-full h-16 text-sm font-semibold border-dashed border-2 border-[hsl(220,14%,20%)] hover:border-[hsl(24,95%,53%)]/50 hover:bg-white/5 rounded-md transition-all flex items-center justify-center gap-2 text-white/60"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-5 w-5" />
              Tap to Select Photo
            </button>

            {/* Image Previews */}
            {images.length > 0 && (
              <div className="space-y-3">
                {images.map((img, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-[hsl(220,14%,16%)] overflow-hidden"
                  >
                    <img
                      src={img.url}
                      alt={`Setup ${index + 1}`}
                      className="w-full h-48 object-cover"
                    />
                    <div className="p-3 bg-[hsl(220,14%,11%)]">
                      <p className="text-sm font-semibold text-white/70 mb-2">
                        Tag this setup:
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleTagImage(index, "good")}
                          className={`h-10 text-sm px-3 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                            img.tag === "good"
                              ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                              : "border border-[hsl(220,14%,20%)] hover:bg-emerald-950/30 text-white/60"
                          }`}
                        >
                          <ThumbsUp className="h-4 w-4" />
                          Good Setup
                        </button>
                        <button
                          onClick={() => handleTagImage(index, "bad")}
                          className={`h-10 text-sm px-3 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                            img.tag === "bad"
                              ? "bg-rose-600 hover:bg-rose-500 text-white"
                              : "border border-[hsl(220,14%,20%)] hover:bg-rose-950/30 text-white/60"
                          }`}
                        >
                          <ThumbsDown className="h-4 w-4" />
                          Bad Setup
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-lg bg-rose-950/40 border border-rose-500/20 p-3 text-rose-300 text-sm font-medium flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Save */}
            {images.length > 0 && (
              <Button
                className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-500"
                onClick={handleSave}
                disabled={createImage.isPending}
              >
                {createImage.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-6 w-6" />
                    Save Images
                  </>
                )}
              </Button>
            )}

            {saved && (
              <div className="rounded-lg bg-emerald-950/40 border border-emerald-500/20 p-3 text-emerald-300 text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Images saved successfully!
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="forge-card">
          <div className="forge-card-body py-3 flex items-start gap-2">
            <Image className="h-5 w-5 text-white/30 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-white/30">
              <strong className="text-white/50">Setup images</strong> help other operators learn from your
              setup. Tag good setups as examples and bad setups as warnings. In
              production, images will be uploaded to cloud storage.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
