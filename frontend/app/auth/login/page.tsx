'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Building2, Lock, Mail, Phone, MessageSquare } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean().default(false).optional(),
})

const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  phone_number: z.string().regex(/^(\+65)?[689]\d{7}$/, 'Please enter a valid Singapore phone number'),
  waba_phone_number: z.string().regex(/^(\+65)?[689]\d{7}$/, 'Please enter a valid Singapore phone number').optional().or(z.literal('')),
})

type LoginForm = z.infer<typeof loginSchema>
type RegisterForm = z.infer<typeof registerSchema>

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isRegisterMode, setIsRegisterMode] = useState(false)

  const { login, register } = useAuth()

  const router = useRouter()

  const {
    register: registerField,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      remember: false,
    },
  })

  const {
    register: registerRegisterField,
    handleSubmit: handleRegisterSubmit,
    formState: { errors: registerErrors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    setError('')

    try {
      await login(data.email, data.password)
      // The login function in AuthContext handles the redirect automatically
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const onRegisterSubmit = async (data: RegisterForm) => {
    setIsLoading(true)
    setError('')

    try {
      const result = await register(data)
      if (result.success) {
        // Switch back to login mode after successful registration
        setIsRegisterMode(false)
      } else {
        setError(result.message)
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card className="shadow-lg">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto h-16 w-16 bg-primary rounded-2xl flex items-center justify-center">
              <Building2 className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-3xl font-bold">
                {isRegisterMode ? 'Create Account' : 'Welcome back'}
              </CardTitle>
              <CardDescription className="mt-2">
                {isRegisterMode
                  ? 'Create your Outpaced agent account'
                  : 'Sign in to your Outpaced account'
                }
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {error && (
              <div className="bg-destructive/15 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            {isRegisterMode ? (
              <form onSubmit={handleRegisterSubmit(onRegisterSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="Enter your email"
                      className="pl-10"
                      {...registerRegisterField('email')}
                    />
                  </div>
                  {registerErrors.email && (
                    <p className="text-sm text-destructive">{registerErrors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="Enter your password (min 8 characters)"
                      className="pl-10"
                      {...registerRegisterField('password')}
                    />
                  </div>
                  {registerErrors.password && (
                    <p className="text-sm text-destructive">{registerErrors.password.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone-number">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone-number"
                      type="tel"
                      placeholder="e.g., +65 9123 4567"
                      className="pl-10"
                      {...registerRegisterField('phone_number')}
                    />
                  </div>
                  {registerErrors.phone_number && (
                    <p className="text-sm text-destructive">{registerErrors.phone_number.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="waba-phone-number">WABA Phone Number (Optional)</Label>
                  <div className="relative">
                    <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="waba-phone-number"
                      type="tel"
                      placeholder="e.g., +65 9123 4567 (optional)"
                      className="pl-10"
                      {...registerRegisterField('waba_phone_number')}
                    />
                  </div>
                  {registerErrors.waba_phone_number && (
                    <p className="text-sm text-destructive">{registerErrors.waba_phone_number.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    If provided, we'll automatically configure your WhatsApp Business account
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      className="pl-10"
                      {...registerField('email')}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      className="pl-10"
                      {...registerField('password')}
                    />
                  </div>
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password.message}</p>
                  )}
                </div>

                <div className="flex items-center justify-start">
                  <div className="flex items-center space-x-2">
                    <Controller
                      name="remember"
                      control={control}
                      render={({ field }) => (
                        <Checkbox
                          id="remember"
                          checked={field.value || false}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                    <Label htmlFor="remember" className="text-sm">
                      Remember me
                    </Label>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? 'Signing in...' : 'Sign in'}
                </Button>
              </form>
            )}

            <div className="text-center">
              <Button
                variant="link"
                onClick={() => {
                  setIsRegisterMode(!isRegisterMode)
                  setError('')
                }}
                className="text-sm"
              >
                {isRegisterMode
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Create one"
                }
              </Button>
            </div>

            {!isRegisterMode && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-background text-muted-foreground">Quick Access</span>
                  </div>
                </div>

                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => router.push('/agent/dashboard')}
                    className="w-full max-w-xs"
                  >
                    Agent Demo
                  </Button>
                </div>
              </>
            )}


          </CardContent>
        </Card>

        <div className="text-center space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">
              Outpaced
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Intelligent Real Estate Lead Management System
            </p>
          </div>

          <div className="flex justify-center space-x-4">
            <Link
              href="/privacy-policy"
              className="text-xs text-muted-foreground hover:text-primary underline"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms-of-service"
              className="text-xs text-muted-foreground hover:text-primary underline"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
