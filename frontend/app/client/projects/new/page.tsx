'use client'

import { useState } from 'react'
import { BriefProjectForm } from '@/components/projects/BriefProjectForm'
import { ManualProjectForm } from '@/components/projects/ManualProjectForm'
import { PageBody, PageHeader } from '@/components/ui/PageHeader'
import { Segmented } from '@/components/ui/Segmented'

type Mode = 'brief' | 'manual'

export default function NewProjectPage() {
  const [mode, setMode] = useState<Mode>('brief')

  return (
    <>
      <PageHeader
        title="Post a project"
        description="Describe the work in your own words and let ClearHire pull out the skills, budget and timeline, or fill in the fields yourself."
        actions={
          <Segmented
            label="How to enter the project"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'brief', label: 'Describe it' },
              { value: 'manual', label: 'Fill in a form' },
            ]}
          />
        }
      />
      <PageBody className={mode === 'brief' ? 'max-w-6xl' : 'max-w-3xl'}>
        {mode === 'brief' ? <BriefProjectForm /> : <ManualProjectForm />}
      </PageBody>
    </>
  )
}
