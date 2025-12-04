import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/GlassCard";
import { GlassButton } from "@/components/GlassButton";
import { 
  DollarSign, 
  Download, 
  Calendar,
  TrendingUp,
  FileText,
  RefreshCw,
  CreditCard,
  Banknote,
  PieChart
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import apiClient from "@/lib/apiClient";

interface PayrollInfo {
  employee_id: string;
  employee_name: string;
  position: string;
  department: string;
  pay_period: {
    start_date: string;
    end_date: string;
  };
  gross_salary: number;
  deductions: {
    tax: number;
    social_security: number;
    medicare: number;
    health_insurance: number;
    retirement: number;
    other: number;
  };
  net_pay: number;
  payment_method: 'direct_deposit' | 'check';
  bank_details?: {
    bank_name: string;
    account_number: string;
    routing_number: string;
  };
  pay_date: string;
  status: 'pending' | 'processed' | 'paid';
}

interface PayrollHistory {
  pay_period: string;
  gross_salary: number;
  net_pay: number;
  pay_date: string;
  status: string;
}

export default function PayrollInfo() {
  const { user } = useAuth();
  const [payrollInfo, setPayrollInfo] = useState<PayrollInfo | null>(null);
  const [payrollHistory, setPayrollHistory] = useState<PayrollHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayrollData();
  }, []);

  const fetchPayrollData = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getPayrollInfo(user?.id || '');
      setPayrollInfo(response.current_payroll);
      setPayrollHistory(response.history || []);
    } catch (error: any) {
      toast.error('Failed to fetch payroll data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadPayslip = async () => {
    try {
      // This would typically generate and download a PDF payslip
      toast.success('Payslip download started');
    } catch (error: any) {
      toast.error('Failed to download payslip: ' + error.message);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'text-green-500 bg-green-500/20';
      case 'processed':
        return 'text-blue-500 bg-blue-500/20';
      case 'pending':
        return 'text-yellow-500 bg-yellow-500/20';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!payrollInfo) {
    return (
      <GlassCard className="p-8 text-center">
        <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-medium mb-2">No payroll information</h3>
        <p className="text-muted-foreground">
          Payroll information will be available once you're set up in the system
        </p>
      </GlassCard>
    );
  }

  const totalDeductions = Object.values(payrollInfo.deductions).reduce((sum, deduction) => sum + deduction, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Payroll Information</h2>
          <p className="text-muted-foreground">
            View your salary details and payment history
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <GlassButton
            variant="outline"
            onClick={fetchPayrollData}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </GlassButton>
          <GlassButton
            variant="primary"
            onClick={downloadPayslip}
          >
            <Download className="w-4 h-4 mr-2" />
            Download Payslip
          </GlassButton>
        </div>
      </div>

      {/* Current Payroll */}
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Calendar className="w-5 h-5 mr-2" />
          Current Pay Period: {formatDate(payrollInfo.pay_period.start_date)} - {formatDate(payrollInfo.pay_period.end_date)}
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Employee Info */}
          <div className="space-y-4">
            <h4 className="font-medium">Employee Information</h4>
            <div className="space-y-2 text-sm">
              <div><strong>Name:</strong> {payrollInfo.employee_name}</div>
              <div><strong>Position:</strong> {payrollInfo.position}</div>
              <div><strong>Department:</strong> {payrollInfo.department}</div>
              <div><strong>Employee ID:</strong> {payrollInfo.employee_id}</div>
            </div>
          </div>

          {/* Salary Breakdown */}
          <div className="space-y-4">
            <h4 className="font-medium">Salary Breakdown</h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Gross Salary:</span>
                <span className="font-medium">{formatCurrency(payrollInfo.gross_salary)}</span>
              </div>
              
              <div className="border-t border-border/50 pt-3">
                <div className="text-sm text-muted-foreground mb-2">Deductions:</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Tax:</span>
                    <span>{formatCurrency(payrollInfo.deductions.tax)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Social Security:</span>
                    <span>{formatCurrency(payrollInfo.deductions.social_security)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Medicare:</span>
                    <span>{formatCurrency(payrollInfo.deductions.medicare)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Health Insurance:</span>
                    <span>{formatCurrency(payrollInfo.deductions.health_insurance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Retirement:</span>
                    <span>{formatCurrency(payrollInfo.deductions.retirement)}</span>
                  </div>
                  {payrollInfo.deductions.other > 0 && (
                    <div className="flex justify-between">
                      <span>Other:</span>
                      <span>{formatCurrency(payrollInfo.deductions.other)}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-between border-t border-border/50 pt-2 mt-2">
                  <span className="font-medium">Total Deductions:</span>
                  <span className="font-medium text-red-500">{formatCurrency(totalDeductions)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Net Pay */}
          <div className="space-y-4">
            <h4 className="font-medium">Payment Information</h4>
            <div className="bg-primary/10 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-primary mb-2">
                {formatCurrency(payrollInfo.net_pay)}
              </div>
              <div className="text-sm text-muted-foreground mb-4">Net Pay</div>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Payment Method:</span>
                  <span className="flex items-center">
                    {payrollInfo.payment_method === 'direct_deposit' ? (
                      <CreditCard className="w-4 h-4 mr-1" />
                    ) : (
                      <Banknote className="w-4 h-4 mr-1" />
                    )}
                    {payrollInfo.payment_method === 'direct_deposit' ? 'Direct Deposit' : 'Check'}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span>Pay Date:</span>
                  <span>{formatDate(payrollInfo.pay_date)}</span>
                </div>
                
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(payrollInfo.status)}`}>
                    {payrollInfo.status.charAt(0).toUpperCase() + payrollInfo.status.slice(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bank Details (if direct deposit) */}
        {payrollInfo.payment_method === 'direct_deposit' && payrollInfo.bank_details && (
          <div className="mt-6 p-4 bg-background/10 rounded-lg">
            <h4 className="font-medium mb-3">Bank Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <strong>Bank:</strong> {payrollInfo.bank_details.bank_name}
              </div>
              <div>
                <strong>Account:</strong> ****{payrollInfo.bank_details.account_number.slice(-4)}
              </div>
              <div>
                <strong>Routing:</strong> {payrollInfo.bank_details.routing_number}
              </div>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Payroll History */}
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <TrendingUp className="w-5 h-5 mr-2" />
          Payment History
        </h3>
        
        <div className="space-y-3">
          {payrollHistory.length === 0 ? (
            <div className="text-center py-8">
              <PieChart className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No payment history</h3>
              <p className="text-muted-foreground">
                Your payment history will appear here
              </p>
            </div>
          ) : (
            payrollHistory.map((payment, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="flex items-center justify-between p-4 bg-background/10 rounded-lg"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{payment.pay_period}</div>
                    <div className="text-sm text-muted-foreground">
                      Paid on {formatDate(payment.pay_date)}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-medium">{formatCurrency(payment.net_pay)}</div>
                  <div className="text-sm text-muted-foreground">
                    Gross: {formatCurrency(payment.gross_salary)}
                  </div>
                  <div className="mt-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                      {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </GlassCard>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-primary mb-1">
            {formatCurrency(payrollInfo.net_pay)}
          </div>
          <div className="text-sm text-muted-foreground">Current Net Pay</div>
        </GlassCard>
        
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-500 mb-1">
            {payrollHistory.length}
          </div>
          <div className="text-sm text-muted-foreground">Total Payments</div>
        </GlassCard>
        
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-green-500 mb-1">
            {formatCurrency(payrollHistory.reduce((sum, payment) => sum + payment.net_pay, 0))}
          </div>
          <div className="text-sm text-muted-foreground">Total Earned</div>
        </GlassCard>
      </div>
    </div>
  );
}
