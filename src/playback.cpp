#include "camera.hpp"
#include "persistence.hpp"
#include "math.hpp"
#include "positions.hpp"
#include "viables.hpp"
#include "rendering.hpp"
#include "graph_util.hpp"
#include <GLFW/glfw3.h>
#include <GL/glu.h>
#include <boost/program_options.hpp>
#include <iostream>
#include <vector>
#include <fstream>

vector<Position> frames(Graph const & g, vector<SeqNum> const & seqs, unsigned const frames_per_pos)
{
	vector<Position> r;

	ReorientedNode n =
		g.to(seqs.front()).node == g.from(seqs[1]).node
			? g.from(seqs.front())
			: g.to(seqs.front());

	foreach (s : seqs)
	{
		pair<vector<Position>, ReorientedNode> p = follow(g, n, s, frames_per_pos);
		r.insert(r.end(), p.first.begin(), p.first.end());
		n = p.second;
	}

	return r;
}

struct Config
{
	string db;
	string script;
	unsigned frames_per_pos;
	string start;
};

optional<Config> config_from_args(int const argc, char const * const * const argv)
{
	namespace po = boost::program_options;

	po::options_description desc("options");
	desc.add_options()
		("help", "show this help")
		("frames-per-pos", po::value<unsigned>()->default_value(9),
			"number of frames rendered per position")
		("script", po::value<string>()->default_value(string()),
			"script file")
		("start", po::value<string>()->default_value("deep half"), "initial node (only used if no script given)")
		("db", po::value<string>()->default_value("positions.txt"),
			"position database file");

	po::variables_map vm;
	po::store(po::parse_command_line(argc, argv, desc), vm);
	po::notify(vm);

	if (vm.count("help")) { std::cout << desc << '\n'; return none; }

	return Config
		{ vm["db"].as<string>()
		, vm["script"].as<string>()
		, vm["frames-per-pos"].as<unsigned>()
		, vm["start"].as<string>() };
}

vector<SeqNum> randomScript(Graph const & g, SeqNum const start, size_t size = 1000)
{
	vector<SeqNum> v{start};

	auto const m = nodes(g);

	std::deque<NodeNum> recent;

	NodeNum node = g.to(start).node;

	while (v.size() < size)
	{
		vector<pair<SeqNum, NodeNum>> choices;

		foreach (s : m.at(node).second)
		{
			auto const to = g.to(s).node;
			if (std::find(recent.begin(), recent.end(), to) == recent.end() || m.at(node).first.empty())
				choices.push_back({s, g.to(s).node});
		}

		if (choices.empty())
			foreach (s : m.at(node).first)
				choices.push_back({s, g.from(s).node});

		assert(!choices.empty());

		auto p = choices[rand()%choices.size()];

		v.push_back(p.first);
		recent.push_back(p.second);
		if (recent.size() > 10) recent.pop_front();

		node = p.second;
	}

	return v;
}

vector<SeqNum> randomScript(Graph const & g, NodeNum const start, size_t size = 1000)
{
	auto o = out(g, start);
	if (o.empty()) throw std::runtime_error("cannot start at node without outgoing nodes");

	std::random_shuffle(o.begin(), o.end());
	return randomScript(g, o.front(), size);
}

int main(int const argc, char const * const * const argv)
{
	try
	{
		std::srand(std::time(nullptr));

		optional<Config> const config = config_from_args(argc, argv);
		if (!config) return 0;

		Graph const graph = loadGraph(config->db);

		vector<SeqNum> seqs;

		if (!config->script.empty())
			seqs = readScript(graph, config->script);
		else if (optional<NodeNum> start = node_by_desc(graph, config->start))
			seqs = randomScript(graph, *start);
		else if (optional<SeqNum> start = seq_by_desc(graph, config->start))
			seqs = randomScript(graph, *start);
		else
			throw runtime_error("no such position/transition");

		if (!glfwInit()) error("could not initialize GLFW");

		GLFWwindow * const window = glfwCreateWindow(640, 480, "Jiu Jitsu Mapper", nullptr, nullptr);
		if (!window) error("could not create window");

		glfwMakeContextCurrent(window);
		glfwSwapInterval(1);

		Camera camera;

		for (Position const & pos : frames(graph, seqs, config->frames_per_pos))
		{
			glfwPollEvents();
			if (glfwWindowShouldClose(window)) return 0;

			camera.rotateHorizontal(-0.005);
			camera.setOffset(xz(between(pos[0][Core], pos[1][Core])));

			if (glfwGetKey(window, GLFW_KEY_UP) == GLFW_PRESS) camera.rotateVertical(-0.05);
			if (glfwGetKey(window, GLFW_KEY_DOWN) == GLFW_PRESS) camera.rotateVertical(0.05);
			if (glfwGetKey(window, GLFW_KEY_LEFT) == GLFW_PRESS) camera.rotateHorizontal(-0.03);
			if (glfwGetKey(window, GLFW_KEY_RIGHT) == GLFW_PRESS) camera.rotateHorizontal(0.03);
			if (glfwGetKey(window, GLFW_KEY_HOME) == GLFW_PRESS) camera.zoom(-0.05);
			if (glfwGetKey(window, GLFW_KEY_END) == GLFW_PRESS) camera.zoom(0.05);

			int width, height;
			glfwGetFramebufferSize(window, &width, &height);

			renderWindow(
				// views:
				{ {0, 0, 1, 1, none, 90}
		//		, {1-.3-.02, .02, .3, .3, optional<unsigned>(0), 90}
		//		, {.02, .02, .3, .3, optional<unsigned>(1), 60}
				},

				nullptr, // no viables
				graph, window, pos, camera,
				none, // no highlighted joint
				false, // not edit mode
				width, height, {0});
		}

		sleep(2);

		glfwTerminate();
	}
	catch (std::exception const & e)
	{
		std::cerr << "error: " << e.what() << '\n';
		return 1;
	}
}
