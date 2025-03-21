// "use client";

// import { motion, AnimatePresence } from "framer-motion";
// import RoomCard from "@/components/room/RoomCard";
// import { useTheme } from "next-themes";
// import { Button } from "@/components/ui/button";
// import { Sun, Moon, Plus } from "lucide-react";
// import { cn } from "@/lib/utils";
// import appConfig from "@/lib/config";

// export default function RoomsList() {
// 	const { theme, setTheme } = useTheme();

// 	return (
// 		<div className="space-y-8 w-full max-w-md mx-auto">
// 			{/* Header with theme toggle */}
// 			<div className="flex justify-between items-center pt-6">
// 				<Button
// 					variant="ghost"
// 					size="icon"
// 					onClick={() =>
// 						setTheme(theme === "dark" ? "light" : "dark")
// 					}
// 					className="rounded-full h-10 w-10"
// 					aria-label={
// 						theme === "dark"
// 							? "Switch to light mode"
// 							: "Switch to dark mode"
// 					}
// 				>
// 					{theme === "dark" ? (
// 						<Sun className="h-5 w-5" />
// 					) : (
// 						<Moon className="h-5 w-5" />
// 					)}
// 				</Button>
// 			</div>

// 			{/* Title section with subtle animation */}
// 			<motion.div
// 				className="text-left"
// 				initial={{ opacity: 0, y: 10 }}
// 				animate={{ opacity: 1, y: 0 }}
// 				transition={{ duration: 0.5 }}
// 			>
// 				<h1 className="text-3xl font-light tracking-tight mb-2">
// 					My Spaces
// 				</h1>
// 				<p className="text-muted-foreground text-sm">
// 					Select a room to control its climate
// 				</p>
// 			</motion.div>

// 			{/* Room cards with staggered animation */}
// 			<div className="space-y-4">
// 				<AnimatePresence>
// 					{appConfig.rooms.map(({ roomName, roomId }, index) => (
// 						<motion.div
// 							key={roomId}
// 							initial={{ opacity: 0, y: 20 }}
// 							animate={{ opacity: 1, y: 0 }}
// 							exit={{ opacity: 0, y: -20 }}
// 							transition={{
// 								duration: 0.4,
// 								delay: index * 0.1,
// 								ease: [0.22, 1, 0.36, 1],
// 							}}
// 						>
// 							<RoomCard room={{ roomName, roomId }} />
// 						</motion.div>
// 					))}
// 				</AnimatePresence>
// 			</div>

// 			{/* Add room button */}
// 			<motion.div
// 				initial={{ opacity: 0, scale: 0.9 }}
// 				animate={{ opacity: 1, scale: 1 }}
// 				transition={{ delay: 0.5, duration: 0.3 }}
// 				className="flex justify-center mt-8"
// 			>
// 				<Button
// 					variant="outline"
// 					className={cn(
// 						"rounded-full px-6 py-6 h-auto group transition-all duration-300",
// 						"border-dashed border-2 hover:border-primary"
// 					)}
// 				>
// 					<Plus className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform duration-300" />
// 					<span className="text-sm font-normal">Add new room</span>
// 				</Button>
// 			</motion.div>
// 		</div>
// 	);
// }
