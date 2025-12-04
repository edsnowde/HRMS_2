import React from 'react';
import { GlassCard } from '@/components/GlassCard';
import { RoleSidebar } from '@/components/RoleSidebar';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface BiasMetrics {
  gender: {
    male: number;
    female: number;
    other: number;
  };
  age: {
    under25: number;
    age25to34: number;
    age35to44: number;
    age45plus: number;
  };
  ethnicity: Record<string, number>;
  education: Record<string, number>;
}

export default function FairnessReport() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['biasMetrics'],
    queryFn: async () => {
      const response = await apiClient.getFairnessMetrics();
      return response as BiasMetrics;
    },
  });

  const genderData = {
    labels: ['Male', 'Female', 'Other'],
    datasets: [
      {
        label: 'Gender Distribution',
        data: metrics ? [
          metrics.gender.male,
          metrics.gender.female,
          metrics.gender.other,
        ] : [],
        backgroundColor: [
          'rgba(54, 162, 235, 0.5)',
          'rgba(255, 99, 132, 0.5)',
          'rgba(75, 192, 192, 0.5)',
        ],
        borderColor: [
          'rgba(54, 162, 235, 1)',
          'rgba(255, 99, 132, 1)',
          'rgba(75, 192, 192, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const ageData = {
    labels: ['Under 25', '25-34', '35-44', '45+'],
    datasets: [
      {
        label: 'Age Distribution',
        data: metrics ? [
          metrics.age.under25,
          metrics.age.age25to34,
          metrics.age.age35to44,
          metrics.age.age45plus,
        ] : [],
        backgroundColor: 'rgba(153, 102, 255, 0.5)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: number) => value + '%',
        },
      },
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <RoleSidebar />
      
      <main className="p-8 md:pr-72">
        <h1 className="text-3xl font-bold mb-6">Fairness & Bias Report</h1>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          <GlassCard className="p-6">
            <h2 className="text-xl font-semibold mb-4">Gender Distribution</h2>
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                Loading...
              </div>
            ) : (
              <Bar data={genderData} options={options} />
            )}
            <div className="mt-4 text-sm text-muted-foreground">
              <p>Key Observations:</p>
              <ul className="list-disc list-inside mt-2">
                <li>Gender representation across applicant pool</li>
                <li>Hiring success rates by gender</li>
                <li>Potential bias indicators in selection process</li>
              </ul>
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <h2 className="text-xl font-semibold mb-4">Age Distribution</h2>
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                Loading...
              </div>
            ) : (
              <Bar data={ageData} options={options} />
            )}
            <div className="mt-4 text-sm text-muted-foreground">
              <p>Key Observations:</p>
              <ul className="list-disc list-inside mt-2">
                <li>Age diversity in applicant pool</li>
                <li>Age-based selection patterns</li>
                <li>Recommendations for age-inclusive hiring</li>
              </ul>
            </div>
          </GlassCard>

          <GlassCard className="p-6 lg:col-span-2">
            <h2 className="text-xl font-semibold mb-4">Recommendations</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Bias Mitigation Steps</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>Review job descriptions for inclusive language</li>
                  <li>Implement structured interviews with standardized questions</li>
                  <li>Provide unconscious bias training for hiring managers</li>
                  <li>Regular audits of selection criteria and decision patterns</li>
                </ul>
              </div>

              <div>
                <h3 className="font-medium mb-2">AI Fairness Controls</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>Regular calibration of AI screening algorithms</li>
                  <li>Monitoring of AI decision patterns across protected groups</li>
                  <li>Human oversight of AI recommendations</li>
                  <li>Transparent documentation of AI decision factors</li>
                </ul>
              </div>
            </div>
          </GlassCard>
        </div>
      </main>
    </div>
  );
}