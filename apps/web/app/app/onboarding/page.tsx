import Link from 'next/link';
import { getSessionUser } from '@/lib/supabase/server';
import { savePreferencesAction } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const { user } = await getSessionUser();

  return (
    <main className="wrap-narrow" style={{ paddingTop: 48, paddingBottom: 80 }}>
      <Link href="/app" className="small muted">
        ← Skip for now
      </Link>
      <span className="eyebrow" style={{ display: 'block', marginTop: 16 }}>
        Two minutes
      </span>
      <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)', margin: '8px 0 10px' }}>
        Welcome{user?.email ? `, ${user.email.split('@')[0]}` : ''}. Let&apos;s set your baseline.
      </h1>
      <p className="muted" style={{ maxWidth: '58ch', marginBottom: 22 }}>
        Four numbers are enough to compute a daily target with Indian BMI cut-offs. You can change any
        of this later, and the app never shares it.
      </p>

      <form action={savePreferencesAction} className="card card-pad">
        <div className="row" style={{ gap: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="height_cm">Height (cm)</label>
            <input className="input" id="height_cm" name="height_cm" type="number" step="0.5" min={100} max={230} required />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="weight_kg">Weight (kg)</label>
            <input className="input" id="weight_kg" name="weight_kg" type="number" step="0.1" min={25} max={300} required />
          </div>
          <div className="field" style={{ width: 100 }}>
            <label htmlFor="age">Age</label>
            <input className="input" id="age" name="age" type="number" min={13} max={100} defaultValue={30} required />
          </div>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="sex">Sex at birth</label>
            <select className="select" id="sex" name="sex" defaultValue="other">
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Prefer not to say</option>
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="activity_level">Activity</label>
            <select className="select" id="activity_level" name="activity_level" defaultValue="moderate">
              <option value="sedentary">Sedentary</option>
              <option value="light">Light</option>
              <option value="moderate">Moderate</option>
              <option value="active">Active</option>
              <option value="very_active">Very active</option>
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="goal">Goal</label>
            <select className="select" id="goal" name="goal" defaultValue="maintain">
              <option value="lose">Lose</option>
              <option value="maintain">Maintain</option>
              <option value="gain">Gain</option>
            </select>
          </div>
        </div>

        <input type="hidden" name="diet_type" value="vegetarian" />
        <input type="hidden" name="cuisine_preference" value="mixed" />
        <input type="hidden" name="prep_time_minutes" value="30" />
        <input type="hidden" name="meal_frequency" value="4" />
        <input type="hidden" name="theme_mode" value="system" />

        <button className="btn btn-primary btn-block" type="submit" style={{ marginTop: 6 }}>
          Set my targets
        </button>
        <p className="tiny muted" style={{ marginTop: 10, textAlign: 'center' }}>
          Diet, cuisine and budget preferences are a step further in goals and settings.
        </p>
      </form>
    </main>
  );
}
