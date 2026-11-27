import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Mail, Store, ArrowRight } from "lucide-react";
import { supabase } from "../../lib/supabase";

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function LoginPage() {
  const navigate = useNavigate();

  const [mode, setMode] = useState("login"); // "login" | "register" | "onboarding"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Campos para crear el comercio al registrarse
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");

  const [userId, setUserId] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [infoMsg, setInfoMsg] = useState(null);

  async function checkUserAndTenant(currentUser) {
    if (!currentUser) {
      setCheckingSession(false);
      return;
    }

    setUserId(currentUser.id);

    const { data: tenant, error } = await supabase
      .from("tenants")
      .select("id")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (!error && tenant) {
      navigate("/admin", { replace: true });
      return;
    }

    // Autenticado pero sin comercio creado aún
    setMode("onboarding");
    setCheckingSession(false);
  }

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (active) checkUserAndTenant(data?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) checkUserAndTenant(session?.user ?? null);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function bootstrapTenantForUser(uid, nameInput, phoneInput) {
    const cleanName = nameInput.trim();
    const baseSlug = slugify(cleanName) || "mi-comercio";
    const uniqueSlug = `${baseSlug}-${Math.floor(100 + Math.random() * 900)}`;

    const { data: createdTenant, error: tenantErr } = await supabase
      .from("tenants")
      .insert([
        {
          user_id: uid,
          business_name: cleanName,
          slug: uniqueSlug,
          phone: phoneInput.trim() || null,
          allow_station_choice: true,
          subscription_plan: "trial",
          subscription_status: "active",
        },
      ])
      .select()
      .single();

    if (tenantErr) {
      throw new Error("No se pudo crear el comercio. Intentá con otro nombre.");
    }

    const tenantId = createdTenant.id;

    // Estación inicial
    const { data: createdStation, error: stationErr } = await supabase
      .from("stations")
      .insert([
        {
          tenant_id: tenantId,
          name: "Puesto 1 • Principal",
          is_active: true,
        },
      ])
      .select()
      .single();

    if (stationErr) {
      throw new Error("El comercio se creó, pero falló la estación inicial.");
    }

    // Servicios base y horarios de lunes a sábado (09:00 - 19:00)
    const defaultSchedules = [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      tenant_id: tenantId,
      station_id: createdStation.id,
      day_of_week: dayOfWeek,
      start_time: "09:00:00",
      end_time: "19:00:00",
    }));

    await Promise.all([
      supabase.from("services").insert([
        {
          tenant_id: tenantId,
          name: "Corte de pelo",
          duration_minutes: 30,
          price: 10000,
          is_active: true,
        },
        {
          tenant_id: tenantId,
          name: "Corte + Barba",
          duration_minutes: 45,
          price: 13500,
          is_active: true,
        },
      ]),
      supabase.from("schedules").insert(defaultSchedules),
    ]);

    navigate("/admin", { replace: true });
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw new Error("Email o contraseña incorrectos.");
        await checkUserAndTenant(data.user);
      } else {
        if (!businessName.trim()) {
          throw new Error("Ingresá el nombre de tu comercio.");
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw new Error(error.message);

        // Si Supabase tiene confirmación de email activa, session puede venir null
        if (data.session && data.user) {
          await bootstrapTenantForUser(data.user.id, businessName, phone);
        } else {
          setInfoMsg(
            "Revisá tu correo para confirmar la cuenta. Al iniciar sesión completaremos tu comercio."
          );
          setMode("login");
        }
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOnboardingSubmit(e) {
    e.preventDefault();
    if (!userId || !businessName.trim()) return;

    setSubmitting(true);
    setErrorMsg(null);

    try {
      await bootstrapTenantForUser(userId, businessName, phone);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center text-sm">
        Verificando sesión...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 space-y-6">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            Panel de Comercios
          </p>
          <h1 className="text-xl font-semibold text-white">
            {mode === "onboarding"
              ? "Configurá tu negocio"
              : mode === "login"
              ? "Iniciar sesión"
              : "Crear cuenta y comercio"}
          </h1>
          <p className="text-xs text-zinc-400">
            {mode === "onboarding"
              ? "Último paso: crearemos tu agenda y enlace público automáticamente."
              : "Gestioná tus turnos, estaciones y recordatorios por WhatsApp."}
          </p>
        </div>

        {mode !== "onboarding" ? (
          <>
            <div className="grid grid-cols-2 rounded-xl border border-zinc-800 bg-zinc-950 p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setErrorMsg(null);
                }}
                className={`rounded-lg py-2 transition ${
                  mode === "login"
                    ? "bg-amber-400 text-zinc-950 font-semibold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Ingresar
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setErrorMsg(null);
                }}
                className={`rounded-lg py-2 transition ${
                  mode === "register"
                    ? "bg-amber-400 text-zinc-950 font-semibold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Registrarse
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-3.5">
              {mode === "register" && (
                <>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-400">
                      Nombre del comercio
                    </label>
                    <div className="relative">
                      <Store className="h-4 w-4 text-zinc-500 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        required
                        placeholder="Ej. Barbería El Galpón"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-10 pr-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-zinc-400">
                      WhatsApp del negocio (opcional)
                    </label>
                    <input
                      type="tel"
                      placeholder="Ej. 2615551234"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="mb-1 block text-xs text-zinc-400">Email</label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-zinc-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="dueño@comercio.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-10 pr-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-400">Contraseña</label>
                <div className="relative">
                  <Lock className="h-4 w-4 text-zinc-500 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-10 pr-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              {infoMsg && (
                <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
                  {infoMsg}
                </p>
              )}

              {errorMsg && (
                <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-amber-300 transition disabled:opacity-40"
              >
                {submitting
                  ? "Procesando..."
                  : mode === "login"
                  ? "Entrar al panel"
                  : "Crear mi cuenta"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </>
        ) : (
          <form onSubmit={handleOnboardingSubmit} className="space-y-3.5">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">
                Nombre del comercio
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Barbería El Galpón"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-400">
                WhatsApp del negocio
              </label>
              <input
                type="tel"
                placeholder="Ej. 2615551234"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            {errorMsg && (
              <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-amber-300 transition disabled:opacity-40"
            >
              {submitting ? "Creando comercio..." : "Finalizar y abrir agenda"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}