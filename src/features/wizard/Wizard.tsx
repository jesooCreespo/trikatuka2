import { useEffect } from 'react'
import { useSession } from '@/state/session'
import { useWizard, type Step } from '@/state/wizard'
import { useRun } from './run-controller'
import { Stepper } from './Stepper'
import { StepConnect } from './StepConnect'
import { StepReport } from './StepReport'
import { StepReview } from './StepReview'
import { StepRun } from './StepRun'
import { StepSelect } from './StepSelect'

/** The step that is actually allowed, given which accounts are connected. */
function allowedStep(step: Step, hasOld: boolean, hasNew: boolean, running: boolean): Step {
  if (running) return 'run'
  if (!hasOld || !hasNew) return 'connect'
  if (step === 'run') return 'report'
  return step
}

export function Wizard() {
  const step = useWizard((s) => s.step)
  const goTo = useWizard((s) => s.goTo)
  const hasOld = useSession((s) => Boolean(s.accounts.old))
  const hasNew = useSession((s) => Boolean(s.accounts.new))
  const running = useRun((s) => s.running)
  const current = allowedStep(step, hasOld, hasNew, running)

  useEffect(() => {
    if (current !== step) goTo(current)
  }, [current, step, goTo])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [current])

  return (
    <div className="space-y-8">
      <Stepper current={current} />
      {current === 'connect' && <StepConnect />}
      {current === 'select' && <StepSelect />}
      {current === 'review' && <StepReview />}
      {current === 'run' && <StepRun />}
      {current === 'report' && <StepReport />}
    </div>
  )
}
