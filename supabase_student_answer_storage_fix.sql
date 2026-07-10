-- Run this once in Supabase SQL Editor to permanently save student answers.
-- It is safe to run more than once.

alter table public.student_results
  add column if not exists response_snapshot jsonb not null default '[]'::jsonb;

create table if not exists public.student_responses (
  id uuid default uuid_generate_v4() primary key,
  quiz_id uuid references public.quizzes(id) on delete cascade not null,
  student_result_id uuid references public.student_results(id) on delete cascade,
  student_name text not null,
  question_text text not null,
  question_bank_id uuid references public.question_bank(id) on delete cascade,
  student_answer text not null,
  question_type text not null default 'MCQ',
  marks_assigned integer,
  ai_reasoning text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.student_responses
  add column if not exists quiz_id uuid references public.quizzes(id) on delete cascade,
  add column if not exists student_result_id uuid references public.student_results(id) on delete cascade,
  add column if not exists student_name text,
  add column if not exists question_text text,
  add column if not exists question_bank_id uuid references public.question_bank(id) on delete cascade,
  add column if not exists student_answer text,
  add column if not exists question_type text default 'MCQ',
  add column if not exists marks_assigned integer,
  add column if not exists ai_reasoning text,
  add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());

alter table public.student_responses enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'student_responses'
      and policyname = 'Students can insert responses'
  ) then
    create policy "Students can insert responses"
      on public.student_responses for insert
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'student_responses'
      and policyname = 'Authenticated users can manage student responses'
  ) then
    create policy "Authenticated users can manage student responses"
      on public.student_responses for all
      using (auth.role() = 'authenticated');
  end if;
end $$;
