import * as React from "react"

import { cn } from "@/lib/utils"

const FormContext = React.createContext<{
  control?: Parameters<typeof import("react-hook-form").useForm>[0];
}>({})

function useFormField() {
  const context = React.useContext(FormContext)
  const { control } = context
  return { control }
}

function Form({
  className,
  control,
  ...props
}: React.ComponentProps<"form"> & { control?: Parameters<typeof import("react-hook-form").useForm>[0] }) {
  return (
    <FormContext.Provider value={{ control }}>
      <form
        data-slot="form"
        className={cn("space-y-6", className)}
        {...props}
      />
    </FormContext.Provider>
  )
}

function FormField({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="form-field"
      className={cn("space-y-1.5", className)}
      {...props}
    />
  )
}

function FormItem({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="form-item"
      className={cn("space-y-1.5", className)}
      {...props}
    />
  )
}

function FormLabel({
  className,
  ...props
}: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="form-label"
      className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)}
      {...props}
    />
  )
}

function FormControl({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="form-control"
      className={cn(className)}
      {...props}
    />
  )
}

function FormMessage({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="form-message"
      className={cn("text-xs text-destructive", className)}
      {...props}
    />
  )
}

function FormDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="form-description"
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
  useFormField,
}
